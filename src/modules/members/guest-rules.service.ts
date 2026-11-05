import { Model, PipelineStage, Types } from 'mongoose';

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import {
  AttendanceStatus,
  MembershipStatus,
} from '../../common/utils/enums.utils';
import { Attendance } from '../../schemas/attendance.schema';
import { Member } from '../../schemas/member.schema';
import { SubscriptionService } from '../subscription/subscription.service';
import {
  dayKeyDaysAgo,
  FREQUENT_GUEST_MIN_SERVICES,
  FREQUENT_GUEST_WINDOW_DAYS,
} from './guest-rules.constants';

/**
 * "YYYY-MM-DD" for an attendance row. Attendance.date is normally that string,
 * but some rows (small-team attendance) hold a real Date or another format;
 * those use the Date itself, or else the row's createdAt day. Nested $cond so
 * $regexMatch only ever sees strings.
 */
const ATTENDANCE_DAY_EXPR = {
  $cond: [
    { $eq: [{ $type: '$date' }, 'date'] },
    { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
    {
      $cond: [
        { $eq: [{ $type: '$date' }, 'string'] },
        {
          $cond: [
            { $regexMatch: { input: '$date', regex: /^\d{4}-\d{2}-\d{2}/ } },
            { $substrBytes: ['$date', 0, 10] },
            { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          ],
        },
        { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
      ],
    },
  ],
};

export interface LimitCounts {
  /** Non-archived people with a member status (incl. legacy null). */
  members: number;
  /** Non-archived VISITORs. */
  guests: number;
  /** VISITORs who attended 4+ services in 60 days; they count as members. */
  frequentGuests: number;
  /** members + frequentGuests: what the member limit is checked against. */
  effectiveMembers: number;
  /** guests - frequentGuests: what the guest limit is checked against. */
  effectiveGuests: number;
}

export interface LimitSnapshot {
  counts: LimitCounts;
  memberLimit: number;
  guestLimit: number;
  /** Room left under each limit; null = unlimited. */
  room: { members: number | null; guests: number | null };
}

export type LimitErrorCode = 'MEMBER_LIMIT' | 'GUEST_LIMIT';

/**
 * Member / guest counting and limit enforcement. Every write path that
 * creates a person or changes their status goes through assertWithinLimits().
 */
@Injectable()
export class GuestRulesService {
  constructor(
    @InjectModel(Member.name) private readonly memberModel: Model<Member>,
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<Attendance>,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * Distinct PRESENT service sessions (service + day) per member since
   * `sinceDay`. Attendance.date is normally "YYYY-MM-DD"; a few legacy rows
   * hold other formats, so those fall back to the row's createdAt day.
   */
  async countPresentSessions(
    memberIds: Types.ObjectId[],
    sinceDay: string,
  ): Promise<Map<string, number>> {
    const result = new Map<string, number>();
    if (!memberIds.length) {
      return result;
    }

    const pipeline: PipelineStage[] = [
      {
        $match: {
          memberId: { $in: memberIds },
          status: AttendanceStatus.PRESENT,
        },
      },
      {
        $addFields: {
          day: ATTENDANCE_DAY_EXPR,
        },
      },
      { $match: { day: { $gte: sinceDay } } },
      {
        $group: {
          _id: {
            memberId: '$memberId',
            service: '$churchServiceId',
            day: '$day',
          },
        },
      },
      { $group: { _id: '$_id.memberId', sessions: { $sum: 1 } } },
    ];

    const rows = await this.attendanceModel.aggregate(pipeline);
    for (const row of rows) {
      result.set(String(row._id), row.sessions);
    }
    return result;
  }

  /** Latest PRESENT day ("YYYY-MM-DD") per member. */
  async lastPresentDays(
    memberIds: Types.ObjectId[],
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (!memberIds.length) {
      return result;
    }
    const rows = await this.attendanceModel.aggregate([
      {
        $match: {
          memberId: { $in: memberIds },
          status: AttendanceStatus.PRESENT,
        },
      },
      {
        $addFields: {
          day: ATTENDANCE_DAY_EXPR,
        },
      },
      { $group: { _id: '$memberId', last: { $max: '$day' } } },
    ]);
    for (const row of rows) {
      result.set(String(row._id), row.last);
    }
    return result;
  }

  /** IDs of non-archived VISITORs in the church who meet the 4-in-60 rule. */
  async getFrequentGuestIds(churchId: Types.ObjectId): Promise<string[]> {
    const guestIds = (await this.memberModel.distinct('_id', {
      churchId: new Types.ObjectId(churchId),
      membershipStatus: MembershipStatus.VISITOR,
    })) as Types.ObjectId[];

    const sessions = await this.countPresentSessions(
      guestIds,
      dayKeyDaysAgo(FREQUENT_GUEST_WINDOW_DAYS),
    );

    return [...sessions.entries()]
      .filter(([, count]) => count >= FREQUENT_GUEST_MIN_SERVICES)
      .map(([id]) => id);
  }

  async isFrequentGuest(memberId: Types.ObjectId): Promise<boolean> {
    const sessions = await this.countPresentSessions(
      [new Types.ObjectId(memberId)],
      dayKeyDaysAgo(FREQUENT_GUEST_WINDOW_DAYS),
    );
    return (
      (sessions.get(String(memberId)) || 0) >= FREQUENT_GUEST_MIN_SERVICES
    );
  }

  /** Church-wide counts (all branches). Archived people are excluded by the Member schema middleware. */
  async getLimitCounts(churchId: Types.ObjectId): Promise<LimitCounts> {
    const church = new Types.ObjectId(churchId);
    const [guests, total, frequentGuestIds] = await Promise.all([
      this.memberModel.countDocuments({
        churchId: church,
        membershipStatus: MembershipStatus.VISITOR,
      }),
      this.memberModel.countDocuments({ churchId: church }),
      this.getFrequentGuestIds(church),
    ]);

    const members = total - guests;
    const frequentGuests = frequentGuestIds.length;

    return {
      members,
      guests,
      frequentGuests,
      effectiveMembers: members + frequentGuests,
      effectiveGuests: guests - frequentGuests,
    };
  }

  async getLimitSnapshot(churchId: Types.ObjectId): Promise<LimitSnapshot> {
    const [counts, member, guest] = await Promise.all([
      this.getLimitCounts(churchId),
      this.subscriptionService.getEffectiveLimit(churchId, 'member'),
      this.subscriptionService.getEffectiveLimit(churchId, 'guest'),
    ]);

    const room = (limit: number, used: number) =>
      limit === -1 ? null : Math.max(limit - used, 0);

    return {
      counts,
      memberLimit: member.limit,
      guestLimit: guest.limit,
      room: {
        members: room(member.limit, counts.effectiveMembers),
        guests: room(guest.limit, counts.effectiveGuests),
      },
    };
  }

  /**
   * Throws a BadRequestException naming the limit that would be exceeded.
   * Deltas may be negative (e.g. converting a guest frees a guest slot).
   * Only increases are checked, so a church already over a limit can still
   * convert or remove people.
   */
  async assertWithinLimits(
    churchId: Types.ObjectId,
    delta: { members?: number; guests?: number },
  ) {
    const addMembers = delta.members ?? 0;
    const addGuests = delta.guests ?? 0;
    if (addMembers <= 0 && addGuests <= 0) {
      return;
    }

    const counts = await this.getLimitCounts(churchId);

    if (addMembers > 0) {
      const check = await this.subscriptionService.checkMemberLimit(
        churchId,
        counts.effectiveMembers + addMembers,
      );
      if (!check.allowed) {
        this.throwLimit('MEMBER_LIMIT', check, counts.effectiveMembers);
      }
    }

    if (addGuests > 0) {
      const check = await this.subscriptionService.checkGuestLimit(
        churchId,
        counts.effectiveGuests + addGuests,
      );
      if (!check.allowed) {
        this.throwLimit('GUEST_LIMIT', check, counts.effectiveGuests);
      }
    }
  }

  private throwLimit(
    code: LimitErrorCode,
    check: { message?: string; limit: number; upgrade?: any },
    current: number,
  ): never {
    throw new BadRequestException({
      statusCode: 400,
      code,
      resource: code === 'MEMBER_LIMIT' ? 'member' : 'guest',
      message: check.message,
      limit: check.limit,
      current,
      upgrade: check.upgrade ?? null,
    });
  }

  /**
   * How a status change moves the counts. A guest who already counts as a
   * member (4-in-60) occupies a member slot, not a guest slot.
   */
  async statusChangeDelta(
    memberId: Types.ObjectId,
    from: string | null | undefined,
    to: string | null | undefined,
  ): Promise<{ members: number; guests: number }> {
    const fromGuest = from === MembershipStatus.VISITOR;
    const toGuest = to === MembershipStatus.VISITOR;
    if (fromGuest === toGuest) {
      return { members: 0, guests: 0 };
    }
    if (fromGuest && !toGuest) {
      // Guest → member. A frequent guest is already counted as a member.
      const alreadyCounted = await this.isFrequentGuest(memberId);
      return { members: alreadyCounted ? 0 : 1, guests: alreadyCounted ? 0 : -1 };
    }
    // Member → guest. If they meet the 4-in-60 rule they keep counting as a member.
    const staysMember = await this.isFrequentGuest(memberId);
    return { members: staysMember ? 0 : -1, guests: staysMember ? 0 : 1 };
  }
}
