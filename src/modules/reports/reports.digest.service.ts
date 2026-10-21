import { Model, Types } from 'mongoose';

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';

import { AdminAccessScope } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { Branch } from '../../schemas/branch.schema';
import { Church } from '../../schemas/church.schema';
import {
  ReportDigestFrequency,
  ReportProfile,
} from '../../schemas/report-profile.schema';
import { ReportPeriod } from '../../schemas/report-snapshot.schema';
import { EmailService } from '../email/email.service';
import { renderEmailLayout } from '../email/templates/email-layout.template';
import { previousPeriodRange, rangeContaining } from './reports.periods';
import { ReportsExportService, formatValue } from './reports.export.service';
import { ReportsService } from './reports.service';
import { ReportScope } from './reports.types';

@Injectable()
export class ReportsDigestService {
  private readonly logger = new Logger(ReportsDigestService.name);

  constructor(
    @InjectModel(Church.name) private churchModel: Model<Church>,
    @InjectModel(Branch.name) private branchModel: Model<Branch>,
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    @InjectModel(ReportProfile.name)
    private profileModel: Model<ReportProfile>,
    private readonly reports: ReportsService,
    private readonly exporter: ReportsExportService,
    private readonly emailService: EmailService,
  ) {}

  // Monday 06:00 UTC: the week that just ended.
  @Cron('0 6 * * 1')
  async weekly() {
    await this.run(ReportPeriod.WEEKLY);
  }

  // First of the month, 06:00 UTC: the month that just ended.
  @Cron('0 6 1 * *')
  async monthly() {
    await this.run(ReportPeriod.MONTHLY);
  }

  /**
   * Freezes the last closed period for every church and branch, then emails
   * digests to people who asked for them. Safe to run more than once: stored
   * snapshots are never recomputed and digests are only sent on the schedule.
   */
  async run(period: ReportPeriod, opts: { sendEmails?: boolean } = {}) {
    const sendEmails = opts.sendEmails ?? true;
    const range = previousPeriodRange(
      period,
      rangeContaining(period, new Date()),
    );
    const stats = { churches: 0, snapshots: 0, emails: 0, failures: 0 };

    const cursor = this.churchModel.find().select('_id name').lean().cursor();
    for await (const church of cursor as AsyncIterable<any>) {
      try {
        stats.churches += 1;
        const churchId = church._id as Types.ObjectId;

        const wide: ReportScope = {
          churchId,
          branchIds: null,
          snapshotBranchId: null,
          label: 'All branches',
        };
        await this.reports.sectionsFor(wide, period, range);
        stats.snapshots += 1;

        const branches = await this.branchModel
          .find({ churchId, isActive: true })
          .select('_id name')
          .lean();
        for (const branch of branches as any[]) {
          await this.reports.sectionsFor(
            {
              churchId,
              branchIds: [branch._id],
              snapshotBranchId: branch._id,
              label: branch.name,
            },
            period,
            range,
          );
          stats.snapshots += 1;
        }

        if (sendEmails) {
          stats.emails += await this.sendDigests(churchId, period);
        }
      } catch (error) {
        stats.failures += 1;
        this.logger.error(
          `Report job failed for church ${church._id}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Report job (${period}) finished: ${JSON.stringify(stats)}`,
    );
    return stats;
  }

  private async sendDigests(churchId: Types.ObjectId, period: ReportPeriod) {
    const wanted =
      period === ReportPeriod.WEEKLY
        ? [ReportDigestFrequency.WEEKLY, ReportDigestFrequency.BOTH]
        : [ReportDigestFrequency.MONTHLY, ReportDigestFrequency.BOTH];

    const profiles = await this.profileModel
      .find({
        churchId,
        adminId: { $ne: null },
        digestFrequency: { $in: wanted },
      })
      .lean();

    let sent = 0;
    for (const profile of profiles) {
      try {
        const admin = await this.adminModel
          .findById(profile.adminId)
          .populate('churchRole');
        if (!admin || !admin.email || !admin.churchRole) {
          continue;
        }

        let scope: ReportScope;
        if (admin.accessScope === AdminAccessScope.ORG_WIDE) {
          scope = {
            churchId,
            branchIds: null,
            snapshotBranchId: null,
            label: 'All branches',
          };
        } else if (admin.defaultBranchId) {
          const branch = await this.branchModel
            .findById(admin.defaultBranchId)
            .select('name')
            .lean();
          scope = {
            churchId,
            branchIds: [admin.defaultBranchId],
            snapshotBranchId: admin.defaultBranchId,
            label: (branch as any)?.name ?? 'Your branch',
          };
        } else {
          continue;
        }

        const defs = await this.reports.includedDefs(admin);
        if (!defs.length) {
          continue;
        }

        const bundle = await this.reports.assembleBundle(scope, defs, {
          period,
        });
        await this.emailService.sendEmail(
          admin.email,
          `Your ${period} church report: ${bundle.range.label}`,
          this.renderDigest(admin, bundle, period),
        );
        sent += 1;
      } catch (error) {
        this.logger.warn(
          `Digest failed for admin ${profile.adminId}: ${(error as Error).message}`,
        );
      }
    }
    return sent;
  }

  private renderDigest(
    admin: Admin,
    bundle: Awaited<ReturnType<ReportsService['assembleBundle']>>,
    period: ReportPeriod,
  ) {
    const rows: { label: string; value: string }[] = [];
    for (const section of bundle.sections) {
      for (const m of section.metrics.slice(0, 2)) {
        const change =
          m.changePct === null || m.changePct === undefined
            ? ''
            : ` (${m.changePct > 0 ? '+' : ''}${m.changePct}%)`;
        rows.push({
          label: `${section.title}: ${m.label}`,
          value: `${formatValue(m.value, m.format, m.currency)}${change}`,
        });
      }
    }

    const base = (process.env.FRONTEND_URL ?? '').replace(/\/$/, '');
    return renderEmailLayout({
      previewText: `Your ${period} church report is ready`,
      heading: `Your ${period} report`,
      greeting: `Hi ${admin.firstName ?? 'there'},`,
      paragraphs: [
        `Here is how things went for ${bundle.scopeLabel} during ${bundle.range.label}.`,
        'Open the full report to see trends, charts and exports.',
      ],
      infoRows: rows.slice(0, 16),
      button: base
        ? { text: 'Open full report', link: `${base}/dashboard/reports` }
        : undefined,
      footerNote:
        'You are receiving this because you turned on report digests. You can change this under Reports > Customize.',
    });
  }
}
