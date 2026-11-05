import { Model, Types } from 'mongoose';

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  MembershipStatus,
  NotificationType,
} from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { Attendance } from '../../schemas/attendance.schema';
import { Department } from '../../schemas/department.schema';
import { MemberPastoralSettings } from '../../schemas/member-pastoral-settings.schema';
import { Member } from '../../schemas/member.schema';
import { SmallTeam } from '../../schemas/small-team.schema';
import { EmailService } from '../email/email.service';
import { renderEmailLayout } from '../email/templates/email-layout.template';
import { NotificationService } from '../notification/notification.service';
import {
  addDays,
  ARCHIVE_AFTER_DAYS_DEFAULT,
  ARCHIVE_AFTER_DAYS_MAX,
  ARCHIVE_AFTER_DAYS_MIN,
  ARCHIVE_DELETION_WARNING_DAYS,
  ARCHIVE_RETENTION_DAYS,
  dayKeyDaysAgo,
} from './guest-rules.constants';
import { GuestRulesService } from './guest-rules.service';

export interface GuestLifecycleChurchResult {
  churchId: string;
  archived: number;
  frequentGuestsFlagged: number;
  warned: number;
  deleted: number;
}

/**
 * Daily guest housekeeping:
 *  1. archive guests with no attendance for the church's archive period;
 *  2. prompt the church to convert guests who attended 4+ services in 60 days;
 *  3. warn (in-app + email) 30 days before archived guests are deleted;
 *  4. permanently delete guests 12 months after archiving.
 *
 * Runs as an in-process @Cron and through POST /internal/cron/guest-lifecycle
 * (Vercel Cron), so it works on both a long-running server and serverless.
 * Idempotent: running it twice in a day changes nothing the second time.
 */
@Injectable()
export class GuestLifecycleService {
  private readonly logger = new Logger(GuestLifecycleService.name);
  private running = false;

  constructor(
    @InjectModel(Member.name) private readonly memberModel: Model<Member>,
    @InjectModel(Attendance.name)
    private readonly attendanceModel: Model<Attendance>,
    @InjectModel(MemberPastoralSettings.name)
    private readonly settingsModel: Model<MemberPastoralSettings>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,
    @InjectModel(SmallTeam.name)
    private readonly smallTeamModel: Model<SmallTeam>,
    @InjectModel(Admin.name) private readonly adminModel: Model<Admin>,
    private readonly guestRulesService: GuestRulesService,
    private readonly notificationService: NotificationService,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async handleCron() {
    if (process.env.DISABLE_IN_PROCESS_CRON === 'true') {
      return;
    }
    await this.runDaily();
  }

  async runDaily(now = new Date()) {
    if (this.running) {
      return { skipped: true, reason: 'already running', churches: [] };
    }
    this.running = true;
    const results: GuestLifecycleChurchResult[] = [];
    try {
      // Every church that has guests, live or archived.
      const churchIds = (await this.memberModel
        .distinct('churchId', { membershipStatus: MembershipStatus.VISITOR })
        .setOptions({ includeArchived: true })) as Types.ObjectId[];

      for (const churchId of churchIds) {
        if (!churchId) {
          continue;
        }
        try {
          results.push(await this.runForChurch(churchId, now));
        } catch (err: any) {
          this.logger.error(
            `Guest lifecycle failed for church ${churchId}: ${err?.message}`,
            err?.stack,
          );
        }
      }
      return { skipped: false, churches: results };
    } finally {
      this.running = false;
    }
  }

  async runForChurch(
    churchId: Types.ObjectId,
    now = new Date(),
  ): Promise<GuestLifecycleChurchResult> {
    const archived = await this.archiveInactiveGuests(churchId, now);
    const frequentGuestsFlagged = await this.flagFrequentGuests(churchId, now);
    const warned = await this.warnBeforeDeletion(churchId, now);
    const deleted = await this.deleteExpiredArchives(churchId, now);
    return {
      churchId: String(churchId),
      archived,
      frequentGuestsFlagged,
      warned,
      deleted,
    };
  }

  private async getArchiveAfterDays(churchId: Types.ObjectId) {
    const settings = await this.settingsModel
      .findOne({ churchId })
      .select('archiveAfterDays')
      .lean();
    const value = settings?.archiveAfterDays ?? ARCHIVE_AFTER_DAYS_DEFAULT;
    return Math.min(
      Math.max(value, ARCHIVE_AFTER_DAYS_MIN),
      ARCHIVE_AFTER_DAYS_MAX,
    );
  }

  /** 1. Guests whose last attendance (or creation, if never attended) is older than the archive period. */
  async archiveInactiveGuests(churchId: Types.ObjectId, now: Date) {
    const days = await this.getArchiveAfterDays(churchId);
    const cutoffDay = dayKeyDaysAgo(days, now);
    const cutoffDate = addDays(now, -days);

    const guests = await this.memberModel
      .find({ churchId, membershipStatus: MembershipStatus.VISITOR })
      .select('_id createdAt')
      .lean();
    if (!guests.length) {
      return 0;
    }

    const lastPresent = await this.guestRulesService.lastPresentDays(
      guests.map((g) => g._id as Types.ObjectId),
    );

    const toArchive = guests
      .filter((g) => {
        const last = lastPresent.get(String(g._id));
        return last ? last < cutoffDay : g.createdAt < cutoffDate;
      })
      .map((g) => g._id);

    if (!toArchive.length) {
      return 0;
    }

    const res = await this.memberModel.updateMany(
      {
        _id: { $in: toArchive },
        membershipStatus: MembershipStatus.VISITOR,
        archivedAt: null,
      },
      { $set: { archivedAt: now, archiveDeletionWarnedAt: null } },
    );

    if (res.modifiedCount) {
      await this.notificationService.createNotification(churchId, {
        title: 'Inactive guests archived',
        body: `${res.modifiedCount} guest(s) with no attendance in ${days} days were moved to the archive and no longer count towards your guest limit. You can restore them from Members → Archived.`,
        type: NotificationType.MEMBER,
      });
    }
    return res.modifiedCount;
  }

  /** 2. Prompt to convert guests who meet the 4-in-60 rule (once per guest). */
  async flagFrequentGuests(churchId: Types.ObjectId, now: Date) {
    const ids = await this.guestRulesService.getFrequentGuestIds(churchId);
    if (!ids.length) {
      return 0;
    }
    const fresh = await this.memberModel
      .find({
        _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
        frequentGuestNotifiedAt: null,
      })
      .select('_id fullName')
      .lean();
    if (!fresh.length) {
      return 0;
    }

    await this.memberModel.updateMany(
      { _id: { $in: fresh.map((m) => m._id) } },
      { $set: { frequentGuestNotifiedAt: now } },
    );

    const names = fresh.slice(0, 5).map((m) => m.fullName).join(', ');
    const more = fresh.length > 5 ? ` and ${fresh.length - 5} more` : '';
    await this.notificationService.createNotification(churchId, {
      title: 'Guests ready to become members',
      body: `${names}${more} attended 4 or more services in the last 60 days, so they now count towards your member limit. Change them to members to add them to departments and teams.`,
      type: NotificationType.MEMBER,
    });
    return fresh.length;
  }

  /** 3. Warn 30 days before deletion, with a link to export the list. */
  async warnBeforeDeletion(churchId: Types.ObjectId, now: Date) {
    const warnBefore = addDays(
      now,
      -(ARCHIVE_RETENTION_DAYS - ARCHIVE_DELETION_WARNING_DAYS),
    );
    const due = await this.memberModel
      .find({
        churchId,
        archivedAt: { $ne: null, $lte: warnBefore },
        archiveDeletionWarnedAt: null,
      })
      .select('_id archivedAt')
      .lean();
    if (!due.length) {
      return 0;
    }

    const earliest = due
      .map((m) => addDays(m.archivedAt!, ARCHIVE_RETENTION_DAYS))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    // Deletion never happens sooner than 30 days after the warning.
    const deleteOn = new Date(
      Math.max(
        earliest.getTime(),
        addDays(now, ARCHIVE_DELETION_WARNING_DAYS).getTime(),
      ),
    );
    const deleteOnText = deleteOn.toDateString();
    const body = `${due.length} archived guest(s) will be permanently deleted on or after ${deleteOnText}. Export the list from Members → Archived if you want to keep a copy.`;

    await this.notificationService.createNotification(churchId, {
      title: 'Archived guests will be deleted in 30 days',
      body,
      type: NotificationType.MEMBER,
    });

    await this.emailChurchAdmins(churchId, due.length, deleteOnText);

    await this.memberModel.updateMany(
      { _id: { $in: due.map((m) => m._id) } },
      { $set: { archiveDeletionWarnedAt: now } },
    );
    return due.length;
  }

  private async emailChurchAdmins(
    churchId: Types.ObjectId,
    count: number,
    deleteOnText: string,
  ) {
    const admins = await this.adminModel
      .find({ churchId, email: { $ne: null } })
      .select('email firstName')
      .lean();
    const base = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const link = `${base}/dashboard/membership/members?tab=archived`;

    for (const admin of admins) {
      if (!admin.email) {
        continue;
      }
      try {
        const html = renderEmailLayout({
          previewText: `${count} archived guests will be deleted on ${deleteOnText}`,
          heading: 'Archived guests will be deleted in 30 days',
          greeting: `Hi ${admin.firstName || 'there'},`,
          paragraphs: [
            `${count} guest(s) have been in your archive for almost 12 months with no attendance. They will be permanently deleted on or after ${deleteOnText}.`,
            'We delete inactive guests so personal data is not kept longer than needed, in line with Nigeria\'s data protection rules.',
            'If you want to keep a copy, export the list before then. To keep someone, restore them from the archive.',
          ],
          button: base ? { text: 'Review and export', link } : undefined,
        });
        await this.emailService.sendEmail(
          admin.email,
          'Archived guests will be deleted in 30 days',
          html,
        );
      } catch (err: any) {
        this.logger.warn(
          `Deletion warning email to ${admin.email} failed: ${err?.message}`,
        );
      }
    }
  }

  /** 4. Delete guests archived 12+ months ago whose warning is at least 30 days old. */
  async deleteExpiredArchives(churchId: Types.ObjectId, now: Date) {
    const archivedBefore = addDays(now, -ARCHIVE_RETENTION_DAYS);
    const warnedBefore = addDays(now, -ARCHIVE_DELETION_WARNING_DAYS);

    const expired = await this.memberModel
      .find({
        churchId,
        archivedAt: { $ne: null, $lte: archivedBefore },
        archiveDeletionWarnedAt: { $ne: null, $lte: warnedBefore },
      })
      .select('_id')
      .lean();
    if (!expired.length) {
      return 0;
    }
    const ids = expired.map((m) => m._id as Types.ObjectId);

    await Promise.all([
      this.attendanceModel.deleteMany({ memberId: { $in: ids } }),
      this.departmentModel.updateMany(
        { members: { $in: ids } },
        { $pull: { members: { $in: ids } } },
      ),
      this.smallTeamModel.updateMany(
        { memberIds: { $in: ids } },
        { $pull: { memberIds: { $in: ids } } },
      ),
    ]);
    const res = await this.memberModel.deleteMany({
      _id: { $in: ids },
      archivedAt: { $ne: null },
    });

    // Count only: no personal data is kept about deleted guests.
    this.logger.log(
      `Deleted ${res.deletedCount} archived guest(s) for church ${churchId}`,
    );
    await this.notificationService.createNotification(churchId, {
      title: 'Archived guests deleted',
      body: `${res.deletedCount} guest(s) archived for 12 months were permanently deleted.`,
      type: NotificationType.MEMBER,
    });
    return res.deletedCount;
  }
}
