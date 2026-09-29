import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Attendance } from '../../schemas/attendance.schema';
import { ChurchService } from '../../schemas/church-service.schema';
import {
  MemberPastoralSettings,
} from '../../schemas/member-pastoral-settings.schema';
import {
  PastoralAlert,
  PastoralAlertCategory,
  PastoralAlertSeverity,
} from '../../schemas/pastoral-alert.schema';
import { Member } from '../../schemas/member.schema';
import { AttendanceStatus, ServiceType } from '../../common/utils/enums.utils';

export interface DashboardAlert {
  alertId: string;
  memberId: string;
  memberName: string;
  memberEmail: string | null;
  memberPhone: string | null;
  category: PastoralAlertCategory;
  categoryLabel: string;
  severity: PastoralAlertSeverity;
  message: string;
  resolved: boolean;
  read: boolean;
  notes: {
    id: string;
    body: string;
    authorName: string;
    createdAt: Date;
  }[];
}

export interface DashboardPayload {
  stats: {
    totalMembers: number;
    needAttention: number;
    highlyEngaged: number;
    firstTimeGuests: number;
    atRisk: number;
    pendingFollowUps: number;
  };
  attention: {
    memberId: string;
    fullName: string;
    initials: string;
    level: 'inactive' | 'at-risk' | 'needs-follow-up';
    absences: number;
  }[];
  recentAlerts: DashboardAlert[];
  trend: { label: string; attendance: number; firstTimers: number }[];
  engagement: {
    active: number;
    growing: number;
    needsFollowUp: number;
    atRisk: number;
    inactive: number;
  };
}

const WEEKS_MS = 7 * 24 * 60 * 60 * 1000;
const CRITICAL_WEEKS = 12;

const CATEGORY_LABELS: Record<PastoralAlertCategory, string> = {
  [PastoralAlertCategory.CRITICAL]: 'Critical Attention',
  [PastoralAlertCategory.ABSENCES]: 'Consecutive Absence',
  [PastoralAlertCategory.DECLINE]: 'Gradual Decline',
  [PastoralAlertCategory.FIRST_TIMERS]: 'First-Timer Follow-Up',
  [PastoralAlertCategory.POSITIVE]: 'Positive Trend',
  [PastoralAlertCategory.RETURNING]: 'Returning',
};

@Injectable()
export class PastoralService {
  constructor(
    @InjectModel(Member.name) private memberModel: Model<Member>,
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @InjectModel(ChurchService.name)
    private churchServiceModel: Model<ChurchService>,
    @InjectModel(MemberPastoralSettings.name)
    private settingsModel: Model<MemberPastoralSettings>,
    @InjectModel(PastoralAlert.name)
    private alertModel: Model<PastoralAlert>,
  ) {}

  // ───────────────────────────────────────────────────────────────────────
  // Settings
  // ───────────────────────────────────────────────────────────────────────

  async getSettings(churchId: Types.ObjectId) {
    let settings = await this.settingsModel.findOne({ churchId });
    if (!settings) {
      settings = await this.settingsModel.create({ churchId });
    }
    return settings;
  }

  async updateSettings(
    churchId: Types.ObjectId,
    update: Partial<{
      needsFollowUpThreshold: number;
      atRiskThreshold: number;
      inactiveThreshold: number;
      trackingMode: string;
      countSpecialEvents: boolean;
      countSmallTeams: boolean;
    }>,
  ) {
    const current = await this.getSettings(churchId);

    // Threshold ordering: needsFollowUp <= atRisk <= inactive. Validate
    // against the merged (saved + incoming) values so partial updates are
    // checked as a whole.
    const merged = {
      needsFollowUpThreshold:
        update.needsFollowUpThreshold ?? current.needsFollowUpThreshold,
      atRiskThreshold: update.atRiskThreshold ?? current.atRiskThreshold,
      inactiveThreshold: update.inactiveThreshold ?? current.inactiveThreshold,
    };

    for (const [key, value] of Object.entries(merged)) {
      if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 52) {
        throw new BadRequestException(
          `${key} must be a whole number between 1 and 52`,
        );
      }
    }

    if (merged.needsFollowUpThreshold > merged.atRiskThreshold) {
      throw new BadRequestException(
        'Needs Follow-Up threshold cannot be greater than the At Risk threshold',
      );
    }
    if (merged.atRiskThreshold > merged.inactiveThreshold) {
      throw new BadRequestException(
        'At Risk threshold cannot be greater than the Inactive threshold',
      );
    }

    const updated = await this.settingsModel.findOneAndUpdate(
      { churchId },
      { $set: update },
      { new: true },
    );
    if (!updated) {
      throw new NotFoundException('Settings not found');
    }
    return updated;
  }

  /**
   * Live impact preview: how many members currently fall into each threshold
   * category and each engagement bucket under the given (or saved) settings.
   * Lets the settings page show real counts next to each slider.
   */
  async getImpactCounts(
    tenant: TenantContext,
    override?: Partial<{
      needsFollowUpThreshold: number;
      atRiskThreshold: number;
      inactiveThreshold: number;
      trackingMode: string;
      countSpecialEvents: boolean;
      countSmallTeams: boolean;
    }>,
  ) {
    const saved = await this.getSettings(tenant.churchId);
    const effective = {
      needsFollowUpThreshold:
        override?.needsFollowUpThreshold ?? saved.needsFollowUpThreshold,
      atRiskThreshold: override?.atRiskThreshold ?? saved.atRiskThreshold,
      inactiveThreshold: override?.inactiveThreshold ?? saved.inactiveThreshold,
      trackingMode: override?.trackingMode ?? saved.trackingMode,
      countSpecialEvents:
        override?.countSpecialEvents ?? saved.countSpecialEvents,
      countSmallTeams: override?.countSmallTeams ?? saved.countSmallTeams,
    } as MemberPastoralSettings;

    const serviceIds = await this.getTrackedServiceIds(tenant, effective);
    const { sessions, presentByMember } = await this.getSessionData(
      tenant,
      serviceIds,
    );

    const members = await this.memberModel
      .find(this.buildMemberFilter(tenant))
      .select('createdAt')
      .lean();

    let needsFollowUp = 0;
    let atRisk = 0;
    let inactive = 0;

    for (const member of members) {
      const memberId = (member._id as any).toString();
      const result = this.classifyMember(
        member,
        sessions,
        presentByMember.get(memberId),
        effective,
      );
      const level = this.levelForMember(
        result.absences,
        result.weeksSinceLast,
        effective,
      );
      if (level === 'needs-follow-up') needsFollowUp++;
      else if (level === 'at-risk') atRisk++;
      else if (level === 'inactive') inactive++;
    }

    return { needsFollowUp, atRisk, inactive, totalMembers: members.length };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Core computation
  // ───────────────────────────────────────────────────────────────────────

  private buildMemberFilter(tenant: TenantContext) {
    // Branch-scoped admins only see their branch's members; org-wide admins
    // see everything in the church.
    const filter: Record<string, unknown> = { churchId: tenant.churchId };
    if (tenant.branchId) {
      filter.branchId = tenant.branchId;
    }
    return filter;
  }

  private async getTrackedServiceIds(
    tenant: TenantContext,
    settings: MemberPastoralSettings,
  ): Promise<Types.ObjectId[]> {
    const services = await this.churchServiceModel
      .find({ churchId: tenant.churchId })
      .select('type day serviceDay')
      .lean();

    const tracked = services.filter((service: any) => {
      if (
        service.type === ServiceType.SPECIAL &&
        !settings.countSpecialEvents
      ) {
        return false;
      }

      const day = (service.day ?? service.serviceDay ?? '')
        .toString()
        .toUpperCase();

      switch (settings.trackingMode) {
        case 'SUNDAYS_ONLY':
          return day === 'SUNDAY';
        case 'SUNDAYS_MIDWEEK':
          return service.type !== ServiceType.SPECIAL;
        case 'ALL_SERVICES':
        default:
          return true;
      }
    });

    return tracked.map((service: any) => service._id as Types.ObjectId);
  }

  /**
   * A "session" is one held service (serviceId + date). Attendance rows are
   * per member, so we derive sessions from the present records once and reuse
   * them for every member's classification.
   */
  private async getSessionData(
    tenant: TenantContext,
    serviceIds: Types.ObjectId[],
  ) {
    if (!serviceIds.length) {
      return { sessions: [] as { key: string; date: Date }[], presentByMember: new Map<string, Set<string>>() };
    }

    const records = await this.attendanceModel
      .find({
        churchServiceId: { $in: serviceIds },
        status: AttendanceStatus.PRESENT,
        ...(tenant.branchId ? { branchId: tenant.branchId } : {}),
      })
      .select('memberId churchServiceId date')
      .lean();

    const sessionMap = new Map<string, Date>();
    const presentByMember = new Map<string, Set<string>>();

    for (const record of records) {
      const serviceId = record.churchServiceId?.toString();
      const date = record.date ? new Date(record.date) : null;
      if (!serviceId || !date || isNaN(date.getTime())) continue;

      const day = date.toISOString().split('T')[0];
      const key = `${serviceId}|${day}`;
      if (!sessionMap.has(key)) sessionMap.set(key, date);

      const memberId = record.memberId?.toString();
      if (!memberId) continue;

      if (!presentByMember.has(memberId)) {
        presentByMember.set(memberId, new Set());
      }
      presentByMember.get(memberId)!.add(key);
    }

    const sessions = Array.from(sessionMap.entries())
      .map(([key, date]) => ({ key, date }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    return { sessions, presentByMember };
  }

  private classifyMember(
    member: any,
    sessions: { key: string; date: Date }[],
    presentKeys: Set<string> | undefined,
    settings: MemberPastoralSettings,
  ) {
    const now = Date.now();
    const joinedAt = member.createdAt ? new Date(member.createdAt) : null;

    // Sessions this member could have attended (on/after they joined)
    const memberSessions = sessions.filter(
      (s) => !joinedAt || s.date >= joinedAt,
    );

    const presents = memberSessions.filter((s) => presentKeys?.has(s.key));
    const attendanceRate = memberSessions.length
      ? Math.round((presents.length / memberSessions.length) * 100)
      : 0;

    // Consecutive absences: walk backwards from the most recent session,
    // stopping at the first session the member attended.
    let absences = 0;
    for (const session of memberSessions) {
      if (presentKeys?.has(session.key)) break;
      absences++;
    }

    const lastPresent = presents[0]?.date ?? null;
    const weeksSinceLast =
      lastPresent !== null
        ? Math.floor((now - lastPresent.getTime()) / WEEKS_MS)
        : null;

    const firstNames = (member.fullName || '').split(' ');
    const firstName = firstNames[0] || member.fullName;

    const alerts: {
      category: PastoralAlertCategory;
      severity: PastoralAlertSeverity;
      message: string;
    }[] = [];

    // Critical: no attendance in 12+ weeks (or never attended)
    if (weeksSinceLast === null || weeksSinceLast >= CRITICAL_WEEKS) {
      alerts.push({
        category: PastoralAlertCategory.CRITICAL,
        severity: PastoralAlertSeverity.URGENT,
        message: `${firstName} hasn't attended in over ${CRITICAL_WEEKS} weeks. They may be going through a difficult season.`,
      });
    }

    if (absences >= settings.needsFollowUpThreshold) {
      const severity =
        absences >= settings.atRiskThreshold
          ? PastoralAlertSeverity.HIGH
          : PastoralAlertSeverity.MEDIUM;
      alerts.push({
        category: PastoralAlertCategory.ABSENCES,
        severity,
        message: `${firstName} has missed ${absences} consecutive services. A caring check-in is recommended.`,
      });
    }

    if (attendanceRate > 0 && attendanceRate < 60 && memberSessions.length >= 3) {
      alerts.push({
        category: PastoralAlertCategory.DECLINE,
        severity: PastoralAlertSeverity.MEDIUM,
        message: `${firstName}'s attendance has declined over the last month. A gentle follow-up could help.`,
      });
    }

    if (memberSessions.length === 1 && presents.length === 1) {
      alerts.push({
        category: PastoralAlertCategory.FIRST_TIMERS,
        severity: PastoralAlertSeverity.MEDIUM,
        message: `${firstName} visited for the first time recently and hasn't returned yet. A welcome follow-up is recommended.`,
      });
    }

    // Returning: was present after a run of absences
    if (absences < settings.needsFollowUpThreshold) {
      let run = 0;
      for (const session of memberSessions) {
        if (presentKeys?.has(session.key)) {
          if (run >= settings.needsFollowUpThreshold) {
            alerts.push({
              category: PastoralAlertCategory.RETURNING,
              severity: PastoralAlertSeverity.INFO,
              message: `${firstName} is back after some time away. A warm welcome back would be encouraging.`,
            });
            break;
          }
          run = 0;
        } else {
          run++;
        }
      }
    }

    // Positive: recent improvement only — an attendance rate that has risen
    // meaningfully across the last month of sessions, or a member returning
    // after a long gap who is attending again. Rating every 80%+ member as
    // "positive" floods the tab in a healthy church.
    if (memberSessions.length >= 3 && presents.length >= 2) {
      const midpoint = Math.floor(memberSessions.length / 2);
      const olderHalf = memberSessions.slice(midpoint);
      const recentHalf = memberSessions.slice(0, midpoint);
      const olderRate = olderHalf.length
        ? olderHalf.filter((s) => presentKeys?.has(s.key)).length /
          olderHalf.length
        : 0;
      const recentRate = recentHalf.length
        ? recentHalf.filter((s) => presentKeys?.has(s.key)).length /
          recentHalf.length
        : 0;

      if (recentRate - olderRate >= 0.2) {
        alerts.push({
          category: PastoralAlertCategory.POSITIVE,
          severity: PastoralAlertSeverity.INFO,
          message: `${firstName}'s engagement has been growing steadily. They may be ready for deeper involvement.`,
        });
      }
    }

    return {
      attendanceRate,
      absences,
      weeksSinceLast,
      presents: presents.length,
      totalSessions: memberSessions.length,
      firstPresentDate: presents[presents.length - 1]?.date ?? null,
      alerts,
    };
  }

  private levelForMember(
    absences: number,
    weeksSinceLast: number | null,
    settings: MemberPastoralSettings,
  ): 'inactive' | 'at-risk' | 'needs-follow-up' | null {
    if (weeksSinceLast !== null && weeksSinceLast >= CRITICAL_WEEKS) {
      return 'inactive';
    }
    if (absences >= settings.inactiveThreshold) return 'inactive';
    if (absences >= settings.atRiskThreshold) return 'at-risk';
    if (absences >= settings.needsFollowUpThreshold) return 'needs-follow-up';
    return null;
  }

  /**
   * Sync computed alerts into PastoralAlert documents. Unresolved alerts that
   * no longer match the computation are deleted; resolved ones are kept for
   * history. Notes on surviving alerts are preserved.
   */
  private async syncAlerts(
    churchId: Types.ObjectId,
    computed: {
      memberId: string;
      category: PastoralAlertCategory;
      severity: PastoralAlertSeverity;
      message: string;
    }[],
  ) {
    const computedKey = new Set(
      computed.map((c) => `${c.memberId}|${c.category}`),
    );

    const existing = await this.alertModel
      .find({ churchId })
      .select('memberId category resolved')
      .lean();

    // Remove unresolved alerts that no longer apply
    const staleIds = existing
      .filter(
        (a) =>
          !a.resolved &&
          !computedKey.has(`${(a.memberId as any).toString()}|${a.category}`),
      )
      .map((a) => a._id);

    if (staleIds.length) {
      await this.alertModel.deleteMany({ _id: { $in: staleIds } });
    }

    // Upsert computed alerts (keep resolved state + notes on existing docs)
    if (computed.length) {
      const bulk = computed.map((c) => ({
        updateOne: {
          filter: {
            churchId,
            memberId: new Types.ObjectId(c.memberId),
            category: c.category,
          },
          update: {
            $set: { severity: c.severity },
            $setOnInsert: {
              resolved: false,
              read: false,
              notes: [],
            },
          },
          upsert: true,
        },
      }));
      await this.alertModel.bulkWrite(bulk, { ordered: false });
    }
  }

  // ───────────────────────────────────────────────────────────────────────
  // Dashboard
  // ───────────────────────────────────────────────────────────────────────

  async getDashboard(tenant: TenantContext): Promise<DashboardPayload> {
    const settings = await this.getSettings(tenant.churchId);
    const serviceIds = await this.getTrackedServiceIds(tenant, settings);
    const { sessions, presentByMember } = await this.getSessionData(
      tenant,
      serviceIds,
    );

    const members = await this.memberModel
      .find(this.buildMemberFilter(tenant))
      .select('fullName email phoneNumber createdAt')
      .lean();

    const initials = (name: string) =>
      (name || 'M')
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase() || 'M';

    const attention: DashboardPayload['attention'] = [];
    const computedAlerts: {
      memberId: string;
      category: PastoralAlertCategory;
      severity: PastoralAlertSeverity;
      message: string;
    }[] = [];

    let highlyEngaged = 0;
    let firstTimeGuests = 0;
    let growing = 0;
    let active = 0;
    let needsFollowUp = 0;
    let atRisk = 0;
    let inactive = 0;

    for (const member of members) {
      const memberId = (member._id as any).toString();
      const result = this.classifyMember(
        member,
        sessions,
        presentByMember.get(memberId),
        settings,
      );

      // Engagement buckets
      if (result.attendanceRate >= 80 && result.totalSessions >= 3) {
        highlyEngaged++;
        active++;
      } else if (result.attendanceRate >= 70 && result.totalSessions >= 3) {
        active++;
      } else if (result.attendanceRate >= 40 && result.totalSessions >= 3) {
        growing++;
      }

      if (result.totalSessions === 1 && result.presents === 1) {
        firstTimeGuests++;
      }

      const level = this.levelForMember(
        result.absences,
        result.weeksSinceLast,
        settings,
      );
      if (level === 'needs-follow-up') needsFollowUp++;
      if (level === 'at-risk') atRisk++;
      if (level === 'inactive') inactive++;

      if (level) {
        attention.push({
          memberId,
          fullName: member.fullName,
          initials: initials(member.fullName),
          level,
          absences: result.absences,
        });
      }

      for (const alert of result.alerts) {
        computedAlerts.push({
          memberId,
          category: alert.category,
          severity: alert.severity,
          message: alert.message,
        });
      }
    }

    await this.syncAlerts(tenant.churchId, computedAlerts);

    // Weekly trend (last 6 weeks)
    const now = new Date();
    const trend: DashboardPayload['trend'] = [];
    for (let i = 5; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);

      let attendance = 0;
      let firstTimers = 0;

      for (const member of members) {
        const memberId = (member._id as any).toString();
        const keys = presentByMember.get(memberId);
        if (!keys) continue;

        for (const key of keys) {
          const date = new Date(key.split('|')[1]);
          if (date >= weekStart && date <= weekEnd) attendance++;
        }

        // First-timer: their only ever present session falls in this week
        if (keys.size === 1) {
          const only = new Date(Array.from(keys)[0].split('|')[1]);
          if (only >= weekStart && only <= weekEnd) firstTimers++;
        }
      }

      trend.push({
        label: `Week ${6 - i}`,
        attendance,
        firstTimers,
      });
    }

    // Recent alerts (top 5, unresolved first, then by severity)
    const alertDocs = await this.alertModel
      .find({ churchId: tenant.churchId, resolved: false })
      .sort({ severity: 1, updatedAt: -1 })
      .limit(5)
      .populate('memberId', 'fullName email phoneNumber')
      .lean();

    const severityOrder: Record<string, number> = {
      [PastoralAlertSeverity.URGENT]: 0,
      [PastoralAlertSeverity.HIGH]: 1,
      [PastoralAlertSeverity.MEDIUM]: 2,
      [PastoralAlertSeverity.INFO]: 3,
    };

    const memberMap = new Map(members.map((m) => [(m._id as any).toString(), m]));
    const recentAlerts: DashboardAlert[] = alertDocs
      .map((doc: any) => {
        const member = memberMap.get(doc.memberId?.toString?.());
        return {
          alertId: (doc._id as any).toString(),
          memberId: doc.memberId?.toString?.() ?? '',
          memberName: member?.fullName ?? doc.memberId?.fullName ?? 'Member',
          memberEmail: member?.email ?? null,
          memberPhone: member?.phoneNumber ?? null,
          category: doc.category,
          categoryLabel: CATEGORY_LABELS[doc.category] ?? doc.category,
          severity: doc.severity,
          message: computedAlerts.find(
            (c) =>
              c.memberId === doc.memberId?.toString?.() &&
              c.category === doc.category,
          )?.message ?? '',
          resolved: doc.resolved,
          read: doc.read,
          notes: (doc.notes ?? []).map((n: any, i: number) => ({
            id: `${doc._id}-${i}`,
            body: n.body,
            authorName: n.authorName,
            createdAt: n.createdAt,
          })),
        };
      })
      .sort(
        (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
      );

    attention.sort((a, b) => b.absences - a.absences);

    return {
      stats: {
        totalMembers: members.length,
        needAttention: attention.length,
        highlyEngaged,
        firstTimeGuests,
        atRisk,
        pendingFollowUps: needsFollowUp,
      },
      attention: attention.slice(0, 5),
      recentAlerts,
      trend,
      engagement: {
        active,
        growing,
        needsFollowUp,
        atRisk,
        inactive,
      },
    };
  }

  // ───────────────────────────────────────────────────────────────────────
  // Alerts
  // ───────────────────────────────────────────────────────────────────────

  async listAlerts(
    tenant: TenantContext,
    category?: PastoralAlertCategory,
    includeResolved?: boolean,
  ): Promise<DashboardAlert[]> {
    const settings = await this.getSettings(tenant.churchId);
    const serviceIds = await this.getTrackedServiceIds(tenant, settings);
    const { sessions, presentByMember } = await this.getSessionData(
      tenant,
      serviceIds,
    );

    const members = await this.memberModel
      .find(this.buildMemberFilter(tenant))
      .select('fullName email phoneNumber createdAt')
      .lean();

    const memberMap = new Map(
      members.map((m) => [(m._id as any).toString(), m]),
    );

    // Recompute message per alert so the copy stays current
    const computedMap = new Map<string, string>();
    for (const member of members) {
      const memberId = (member._id as any).toString();
      const result = this.classifyMember(
        member,
        sessions,
        presentByMember.get(memberId),
        settings,
      );
      for (const alert of result.alerts) {
        computedMap.set(`${memberId}|${alert.category}`, alert.message);
      }
    }

    const filter: Record<string, unknown> = { churchId: tenant.churchId };
    if (category) filter.category = category;
    if (!includeResolved) filter.resolved = false;

    const docs = await this.alertModel
      .find(filter)
      .sort({ severity: 1, updatedAt: -1 })
      .limit(200)
      .lean();

    const severityOrder: Record<string, number> = {
      [PastoralAlertSeverity.URGENT]: 0,
      [PastoralAlertSeverity.HIGH]: 1,
      [PastoralAlertSeverity.MEDIUM]: 2,
      [PastoralAlertSeverity.INFO]: 3,
    };

    return docs
      .map((doc: any) => {
        const memberId = doc.memberId?.toString?.() ?? '';
        const member = memberMap.get(memberId);
        return {
          alertId: (doc._id as any).toString(),
          memberId,
          memberName: member?.fullName ?? 'Member',
          memberEmail: member?.email ?? null,
          memberPhone: member?.phoneNumber ?? null,
          category: doc.category,
          categoryLabel: CATEGORY_LABELS[doc.category] ?? doc.category,
          severity: doc.severity,
          message:
            computedMap.get(`${memberId}|${doc.category}`) ?? '',
          resolved: doc.resolved,
          read: doc.read,
          notes: (doc.notes ?? []).map((n: any, i: number) => ({
            id: `${doc._id}-${i}`,
            body: n.body,
            authorName: n.authorName,
            createdAt: n.createdAt,
          })),
        };
      })
      .sort(
        (a, b) =>
          severityOrder[a.severity] - severityOrder[b.severity] ||
          a.memberName.localeCompare(b.memberName),
      );
  }

  private async getAlertInChurch(alertId: string, churchId: Types.ObjectId) {
    if (!Types.ObjectId.isValid(alertId)) {
      throw new NotFoundException('Alert not found');
    }
    const alert = await this.alertModel.findOne({
      _id: new Types.ObjectId(alertId),
      churchId,
    });
    if (!alert) throw new NotFoundException('Alert not found');
    return alert;
  }

  async setResolved(
    churchId: Types.ObjectId,
    alertId: string,
    resolved: boolean,
    admin: { id: Types.ObjectId; name: string },
    outcomeNote?: string,
  ) {
    const alert = await this.getAlertInChurch(alertId, churchId);
    alert.resolved = resolved;
    alert.resolvedAt = resolved ? new Date() : null;
    alert.resolvedBy = resolved ? admin.id : null;

    // Accountability: resolving requires a short outcome note that lands in
    // the alert's note history, marked as a resolve-outcome.
    if (resolved && outcomeNote?.trim()) {
      alert.notes.push({
        body: outcomeNote.trim(),
        authorId: admin.id,
        authorName: admin.name,
        createdAt: new Date(),
        kind: 'resolve-outcome',
      } as any);
    }

    await alert.save();
    return alert;
  }

  async setRead(churchId: Types.ObjectId, alertId: string, read: boolean) {
    const alert = await this.getAlertInChurch(alertId, churchId);
    alert.read = read;
    await alert.save();
    return alert;
  }

  async addNote(
    churchId: Types.ObjectId,
    alertId: string,
    body: string,
    author: { id: Types.ObjectId; name: string },
  ) {
    const alert = await this.getAlertInChurch(alertId, churchId);
    alert.notes.push({
      body,
      authorId: author.id,
      authorName: author.name,
      createdAt: new Date(),
      kind: 'general',
    } as any);
    await alert.save();
    return alert.notes;
  }

  async updateNote(
    churchId: Types.ObjectId,
    alertId: string,
    noteIndex: number,
    adminId: Types.ObjectId,
    body: string,
  ) {
    const alert = await this.getAlertInChurch(alertId, churchId);
    const note = alert.notes[noteIndex];
    if (!note) throw new NotFoundException('Note not found');

    // Only the author may edit their own note.
    if (note.authorId?.toString() !== adminId.toString()) {
      throw new NotFoundException('Note not found');
    }

    note.body = body;
    note.updatedAt = new Date();
    await alert.save();
    return alert.notes;
  }

  async deleteNote(
    churchId: Types.ObjectId,
    alertId: string,
    noteIndex: number,
    adminId: Types.ObjectId,
  ) {
    const alert = await this.getAlertInChurch(alertId, churchId);
    const note = alert.notes[noteIndex];
    if (!note) throw new NotFoundException('Note not found');

    if (note.authorId?.toString() !== adminId.toString()) {
      throw new NotFoundException('Note not found');
    }

    alert.notes.splice(noteIndex, 1);
    await alert.save();
    return alert.notes;
  }
}
