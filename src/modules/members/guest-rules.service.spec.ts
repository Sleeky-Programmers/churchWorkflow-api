import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

import { MemberLimitType } from '../../common/utils/enums.utils';
import { dayKeyDaysAgo } from './guest-rules.constants';
import { GuestRulesService } from './guest-rules.service';

const churchId = new Types.ObjectId();
const guestA = new Types.ObjectId();
const guestB = new Types.ObjectId();

/**
 * Fake models: `members` = non-archived people (the schema middleware hides
 * archived ones), `sessions` = what the attendance aggregation returns.
 */
function build(opts: {
  members: number;
  guests: number;
  sessions?: { _id: Types.ObjectId; sessions: number }[];
  memberLimit: number;
  guestLimit: number;
}) {
  const memberModel: any = {
    countDocuments: jest.fn(async (filter: any) => {
      return filter.membershipStatus ? opts.guests : opts.members + opts.guests;
    }),
    distinct: jest.fn(async () => {
      return [guestA, guestB];
    }),
  };
  const attendanceModel: any = {
    aggregate: jest.fn(async () => {
      return opts.sessions ?? [];
    }),
  };
  const check = (limit: number) => {
    return async (_: any, projected: number) => {
      return limit !== -1 && projected > limit
        ? {
            allowed: false,
            type: MemberLimitType.BLOCK,
            limit,
            message: 'over',
          }
        : { allowed: true, type: MemberLimitType.NONE, limit };
    };
  };
  const subscriptionService: any = {
    checkMemberLimit: jest.fn(check(opts.memberLimit)),
    checkGuestLimit: jest.fn(check(opts.guestLimit)),
    getEffectiveLimit: jest.fn(async (_: any, r: string) => {
      return {
        limit: r === 'member' ? opts.memberLimit : opts.guestLimit,
        plan: 'STARTER',
      };
    }),
  };
  const service = new GuestRulesService(
    memberModel,
    attendanceModel,
    subscriptionService,
  );
  return { service, memberModel, attendanceModel, subscriptionService };
}

describe('GuestRulesService', () => {
  it('moves guests with 4+ sessions in 60 days into the member count', async () => {
    const { service } = build({
      members: 40,
      guests: 10,
      sessions: [
        { _id: guestA, sessions: 4 },
        { _id: guestB, sessions: 3 },
      ],
      memberLimit: 100,
      guestLimit: 200,
    });

    const counts = await service.getLimitCounts(churchId);
    expect(counts).toEqual({
      members: 40,
      guests: 10,
      frequentGuests: 1,
      effectiveMembers: 41,
      effectiveGuests: 9,
    });
  });

  it('only counts attendance inside the 60-day window', async () => {
    const { service, attendanceModel } = build({
      members: 0,
      guests: 2,
      memberLimit: 100,
      guestLimit: 200,
    });
    await service.getFrequentGuestIds(churchId);

    const pipeline = attendanceModel.aggregate.mock.calls[0][0];
    const windowStage = pipeline.find((s: any) => {
      return s.$match?.day;
    });
    expect(windowStage.$match.day.$gte).toBe(dayKeyDaysAgo(60));
    // Distinct sessions are service + day, so two marks for the same service/day count once.
    const group = pipeline.find((s: any) => {
      return s.$group?._id?.service;
    });
    expect(group.$group._id).toEqual({
      memberId: '$memberId',
      service: '$churchServiceId',
      day: '$day',
    });
  });

  it('blocks a new guest at the guest limit and names the guest limit', async () => {
    const { service } = build({
      members: 10,
      guests: 200,
      memberLimit: 100,
      guestLimit: 200,
    });

    await expect(
      service.assertWithinLimits(churchId, { guests: 1 }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'GUEST_LIMIT', limit: 200 }),
    });
  });

  it('still allows a new member when only the guest limit is full', async () => {
    const { service } = build({
      members: 10,
      guests: 200,
      memberLimit: 100,
      guestLimit: 200,
    });
    await expect(
      service.assertWithinLimits(churchId, { members: 1 }),
    ).resolves.toBeUndefined();
  });

  it('blocks converting a guest to a member at the member limit', async () => {
    const { service } = build({
      members: 100,
      guests: 5,
      sessions: [],
      memberLimit: 100,
      guestLimit: 200,
    });

    const delta = await service.statusChangeDelta(guestA, 'VISITOR', 'MEMBER');
    expect(delta).toEqual({ members: 1, guests: -1 });
    await expect(service.assertWithinLimits(churchId, delta)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('a frequent guest converting to member uses no new slot', async () => {
    const { service } = build({
      members: 99,
      guests: 5,
      sessions: [{ _id: guestA, sessions: 5 }],
      memberLimit: 100,
      guestLimit: 200,
    });
    const delta = await service.statusChangeDelta(guestA, 'VISITOR', 'LEADER');
    expect(delta).toEqual({ members: 0, guests: 0 });
  });

  it('never blocks changes that only free up room', async () => {
    const { service, subscriptionService } = build({
      members: 500,
      guests: 500,
      memberLimit: 100,
      guestLimit: 200,
    });
    await service.assertWithinLimits(churchId, { members: -1, guests: 0 });
    expect(subscriptionService.checkMemberLimit).not.toHaveBeenCalled();
  });

  it('reports room left, null when unlimited', async () => {
    const { service } = build({
      members: 87,
      guests: 140,
      memberLimit: 100,
      guestLimit: -1,
    });
    const snapshot = await service.getLimitSnapshot(churchId);
    expect(snapshot.room).toEqual({ members: 13, guests: null });
  });
});
