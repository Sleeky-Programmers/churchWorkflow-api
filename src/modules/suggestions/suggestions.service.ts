import { Model, Types } from 'mongoose';

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import {
  AccessLevel,
  AssetStatus,
  ModuleSections,
  RequisitionStatus,
} from '../../common/utils/enums.utils';
import { roleHasAccess } from '../../common/utils/role-access.util';
import { Admin } from '../../schemas/admin.schema';
import { Asset } from '../../schemas/asset.schema';
import {
  GivingBatch,
  GivingBatchStatus,
} from '../../schemas/giving-batch.schema';
import { PastoralAlert } from '../../schemas/pastoral-alert.schema';
import { Requisition } from '../../schemas/requisition.schema';
import { Role } from '../../schemas/role.schema';
import { UsageStat, UsageStatKind } from '../../schemas/usage-stat.schema';
import { UsageEventDto } from './dto/suggestions.dto';
import { findAction, findPage, normalizePagePath } from './suggestions.catalog';

export type SuggestionType =
  | 'next_step'
  | 'time_habit'
  | 'neglected'
  | 'pending_work'
  | 'popular_for_role';

export interface Suggestion {
  id: string;
  type: SuggestionType;
  title: string;
  message: string;
  href: string;
  // Where on screen the suggestion can appear, most specific first.
  anchors?: string[];
  priority: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_SHOWN = 4;
const DISMISS_SNOOZE_DAYS = 7;
const DISMISS_LIMIT = 3;
const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

@Injectable()
export class SuggestionsService {
  constructor(
    @InjectModel(UsageStat.name) private usageModel: Model<UsageStat>,
    @InjectModel(Requisition.name) private requisitionModel: Model<Requisition>,
    @InjectModel(GivingBatch.name) private givingBatchModel: Model<GivingBatch>,
    @InjectModel(PastoralAlert.name)
    private pastoralAlertModel: Model<PastoralAlert>,
    @InjectModel(Asset.name) private assetModel: Model<Asset>,
  ) {}

  // ---------------------------------------------------------------------
  // Tracking
  // ---------------------------------------------------------------------

  async track(authUser: Admin, events: UsageEventDto[]) {
    if (!authUser.churchId || !events?.length) {
      return { recorded: 0 };
    }

    const now = new Date();
    const hour = String(now.getUTCHours());
    const day = String(now.getUTCDay());
    const roleId = this.roleIdOf(authUser);
    let recorded = 0;

    for (const event of events) {
      if (event.kind === 'page') {
        const page = normalizePagePath(event.key);
        if (!page) {
          continue;
        }

        await this.bump(authUser, roleId, UsageStatKind.PAGE, page, {
          now,
          hour,
          day,
        });
        recorded += 1;

        const from = normalizePagePath(event.from);
        if (from && from !== page) {
          await this.bump(
            authUser,
            roleId,
            UsageStatKind.TRANSITION,
            `${from}>${page}`,
            { now },
          );
        }

        // The seconds reported belong to the page they just left.
        if (from && event.seconds) {
          await this.usageModel.updateOne(
            { adminId: authUser._id, kind: UsageStatKind.PAGE, key: from },
            { $inc: { totalSeconds: event.seconds } },
          );
        }
      } else if (event.kind === 'action') {
        if (!findAction(event.key)) {
          continue;
        }

        await this.bump(authUser, roleId, UsageStatKind.ACTION, event.key, {
          now,
          hour,
          day,
        });
        recorded += 1;
      }
    }

    return { recorded };
  }

  async dismiss(authUser: Admin, suggestionId: string) {
    if (!authUser.churchId) {
      return { dismissed: false };
    }

    await this.usageModel.updateOne(
      {
        adminId: authUser._id,
        kind: UsageStatKind.SUGGESTION,
        key: suggestionId.slice(0, 200),
      },
      {
        $setOnInsert: { churchId: authUser.churchId },
        $inc: { dismissedCount: 1 },
        $set: { lastDismissedAt: new Date(), lastAt: new Date() },
      },
      { upsert: true, setDefaultsOnInsert: false },
    );

    return { dismissed: true };
  }

  private async bump(
    authUser: Admin,
    roleId: Types.ObjectId | null,
    kind: UsageStatKind,
    key: string,
    opts: { now: Date; hour?: string; day?: string },
  ) {
    const inc: Record<string, number> = { count: 1 };
    if (opts.hour !== undefined) {
      inc[`hourCounts.${opts.hour}`] = 1;
    }
    if (opts.day !== undefined) {
      inc[`dayCounts.${opts.day}`] = 1;
    }

    await this.usageModel.updateOne(
      { adminId: authUser._id, kind, key },
      {
        $setOnInsert: { churchId: authUser.churchId },
        $set: { lastAt: opts.now, roleId },
        $inc: inc,
      },
      { upsert: true, setDefaultsOnInsert: false },
    );
  }

  // ---------------------------------------------------------------------
  // Suggestions
  // ---------------------------------------------------------------------

  async getSuggestions(
    authUser: Admin,
    tenant: TenantContext | undefined,
    currentRaw?: string,
  ): Promise<Suggestion[]> {
    if (!authUser.churchId || !tenant) {
      return [];
    }

    const role = authUser.churchRole as unknown as Role;
    const current = normalizePagePath(currentRaw);
    const now = new Date();

    const [stats, dismissals] = await Promise.all([
      this.usageModel
        .find({
          adminId: authUser._id,
          kind: {
            $in: [
              UsageStatKind.PAGE,
              UsageStatKind.ACTION,
              UsageStatKind.TRANSITION,
            ],
          },
        })
        .limit(400)
        .lean(),
      this.usageModel
        .find({ adminId: authUser._id, kind: UsageStatKind.SUGGESTION })
        .lean(),
    ]);

    const suppressed = new Set<string>();
    for (const d of dismissals) {
      const snoozed =
        d.lastDismissedAt &&
        now.getTime() - d.lastDismissedAt.getTime() <
          DISMISS_SNOOZE_DAYS * DAY_MS;
      if (d.dismissedCount >= DISMISS_LIMIT || snoozed) {
        suppressed.add(d.key);
      }
    }

    const allowed = (section: ModuleSections | null) => {
      return section === null || roleHasAccess(role, section, AccessLevel.VIEW);
    };

    const pages = stats.filter((s) => {
      return s.kind === UsageStatKind.PAGE;
    });
    const actions = stats.filter((s) => {
      return s.kind === UsageStatKind.ACTION;
    });
    const transitions = stats.filter((s) => {
      return s.kind === UsageStatKind.TRANSITION;
    });
    const visitedCount = new Map(
      pages.map((p) => {
        return [p.key, p.count];
      }),
    );
    const totalVisits = pages.reduce((sum, p) => {
      return sum + p.count;
    }, 0);

    const out: Suggestion[] = [];

    // 1. Likely next step from the page they are on.
    if (current) {
      const fromHere = transitions.filter((t) => {
        return t.key.startsWith(`${current}>`);
      });
      const total = fromHere.reduce((sum, t) => {
        return sum + t.count;
      }, 0);
      const currentLabel = findPage(current)?.label ?? 'this page';

      for (const t of fromHere) {
        const target = t.key.split('>')[1];
        const page = findPage(target);
        const share = total ? t.count / total : 0;
        if (!page || t.count < 3 || share < 0.25 || !allowed(page.section)) {
          continue;
        }
        out.push({
          id: `next_step:${t.key}`,
          type: 'next_step',
          title: `Next up: ${page.label}`,
          message: `After ${currentLabel}, you often head to ${page.label}.`,
          href: page.path,
          priority: 70 + share * 20,
        });
      }
    }

    // 2. Habits that line up with the current day and time.
    const hour = now.getUTCHours();
    const day = now.getUTCDay();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    for (const stat of [...pages, ...actions]) {
      if (stat.count < 5) {
        continue;
      }

      const meta =
        stat.kind === UsageStatKind.PAGE
          ? findPage(stat.key)
          : findAction(stat.key);
      if (!meta || !allowed(meta.section)) {
        continue;
      }

      const href =
        stat.kind === UsageStatKind.PAGE
          ? (meta as { path: string }).path
          : (meta as { href: string }).href;
      if (href === current || stat.lastAt >= startOfToday) {
        continue;
      }

      const hours = stat.hourCounts ?? {};
      const nearHour = [-1, 0, 1].reduce((sum, offset) => {
        return sum + (hours[String((hour + offset + 24) % 24)] ?? 0);
      }, 0);
      const hourShare = nearHour / stat.count;
      const dayShare = (stat.dayCounts?.[String(day)] ?? 0) / stat.count;
      if (hourShare < 0.4 || dayShare < 0.3) {
        continue;
      }

      const what =
        stat.kind === UsageStatKind.PAGE
          ? (meta as { label: string }).label
          : (meta as { verb: string }).verb;

      out.push({
        id: `time_habit:${stat.key}`,
        type: 'time_habit',
        title: what,
        message: `You usually do this around now on ${WEEKDAYS[day]}s.`,
        href,
        anchors:
          stat.kind === UsageStatKind.ACTION
            ? [`action:${stat.key}`]
            : undefined,
        priority: 60 + hourShare * dayShare * 30,
      });
    }

    // 3. Something they used to open often but have not for a while.
    const neglected = pages
      .filter((p) => {
        const page = findPage(p.key);
        return (
          page &&
          allowed(page.section) &&
          p.count >= 8 &&
          now.getTime() - p.lastAt.getTime() > 21 * DAY_MS &&
          p.key !== current
        );
      })
      .sort((a, b) => {
        return b.count - a.count;
      })[0];
    if (neglected) {
      const page = findPage(neglected.key)!;
      out.push({
        id: `neglected:${neglected.key}`,
        type: 'neglected',
        title: `Check in on ${page.label}`,
        message: `You haven't opened ${page.label} in a few weeks.`,
        href: page.path,
        priority: 40,
      });
    }

    // 4. Live work that is waiting for this person.
    out.push(...(await this.pendingWork(role, tenant, current, visitedCount)));

    // 5. Brand-new users: what others in the same role use.
    if (totalVisits < 15) {
      out.push(
        ...(await this.popularForRole(
          authUser,
          allowed,
          visitedCount,
          current,
        )),
      );
    }

    const seen = new Set<string>();
    return out
      .filter((s) => {
        if (suppressed.has(s.id) || seen.has(s.id) || s.href === current) {
          return false;
        }
        seen.add(s.id);
        return true;
      })
      .sort((a, b) => {
        return b.priority - a.priority;
      })
      .slice(0, MAX_SHOWN)
      .map((s) => {
        return {
          ...s,
          priority: Math.round(s.priority),
          anchors: [...(s.anchors ?? []), ...this.navAnchors(s.href)],
        };
      });
  }

  /**
   * Places on screen a suggestion can sit beside, most specific first: the
   * page itself, then each parent section (so a suggestion for a sub-page
   * can still appear beside its module in the sidebar).
   */
  private navAnchors(href: string): string[] {
    const parts = href.split('/').filter(Boolean);
    const anchors: string[] = [];
    for (let i = parts.length; i > 1; i--) {
      anchors.push(`nav:/${parts.slice(0, i).join('/')}`);
    }
    return anchors;
  }

  private async pendingWork(
    role: Role,
    tenant: TenantContext,
    current: string | null,
    visitedCount: Map<string, number>,
  ): Promise<Suggestion[]> {
    const branchIds = tenant.accessibleBranchIds ?? [];
    const branchFilter = {
      churchId: tenant.churchId,
      branchId: { $in: branchIds },
    };
    const boost = (href: string) => {
      return (visitedCount.get(href) ?? 0) >= 3 ? 8 : 0;
    };
    const out: Suggestion[] = [];
    const tasks: Promise<void>[] = [];

    if (roleHasAccess(role, ModuleSections.REQUESTS, AccessLevel.FULL_ACCESS)) {
      tasks.push(
        this.requisitionModel
          .countDocuments({
            ...branchFilter,
            status: RequisitionStatus.PENDING,
          })
          .then((n) => {
            if (n > 0) {
              const href = '/dashboard/requests';
              out.push({
                id: 'pending_work:requisitions',
                type: 'pending_work',
                title: `${n} ${n === 1 ? 'request' : 'requests'} awaiting your review`,
                message: 'Approving or declining keeps departments moving.',
                href,
                priority: 85 + boost(href),
              });
            }
          }),
      );
    }

    if (
      roleHasAccess(
        role,
        ModuleSections.GIVING_AND_EXPENSES,
        AccessLevel.MANAGE,
      )
    ) {
      tasks.push(
        this.givingBatchModel
          .countDocuments({
            ...branchFilter,
            status: GivingBatchStatus.DRAFT,
            isVoided: false,
          })
          .then((n) => {
            if (n > 0) {
              const href = '/dashboard/finance/giving';
              out.push({
                id: 'pending_work:giving-drafts',
                type: 'pending_work',
                title: `${n} giving ${n === 1 ? 'record is' : 'records are'} still in draft`,
                message: 'Submit or confirm them so your totals are complete.',
                href,
                priority: 82 + boost(href),
              });
            }
          }),
      );
    }

    if (roleHasAccess(role, ModuleSections.MEMBERS, AccessLevel.VIEW)) {
      tasks.push(
        this.pastoralAlertModel
          .aggregate([
            {
              $match: {
                churchId: tenant.churchId,
                resolved: false,
                severity: { $in: ['urgent', 'high'] },
              },
            },
            {
              $lookup: {
                from: 'members',
                localField: 'memberId',
                foreignField: '_id',
                as: 'member',
              },
            },
            { $unwind: '$member' },
            { $match: { 'member.branchId': { $in: branchIds } } },
            { $count: 'n' },
          ])
          .then((rows: { n: number }[]) => {
            const n = rows[0]?.n ?? 0;
            if (n > 0) {
              const href = '/dashboard/membership/attention-center';
              out.push({
                id: 'pending_work:pastoral',
                type: 'pending_work',
                title: `${n} ${n === 1 ? 'member needs' : 'members need'} your care`,
                message:
                  'There are urgent or high-priority alerts to follow up.',
                href,
                priority: 88 + boost(href),
              });
            }
          }),
      );
    }

    if (roleHasAccess(role, ModuleSections.ASSETS, AccessLevel.VIEW)) {
      tasks.push(
        this.assetModel
          .countDocuments({
            ...branchFilter,
            status: AssetStatus.ACTIVE,
            'schedule.nextDue': { $lt: new Date() },
          })
          .then((n) => {
            if (n > 0) {
              const href = '/dashboard/asset-management';
              out.push({
                id: 'pending_work:assets-overdue',
                type: 'pending_work',
                title: `${n} ${n === 1 ? 'asset is' : 'assets are'} overdue for service`,
                message:
                  'A quick service log keeps your equipment in good shape.',
                href,
                priority: 75 + boost(href),
              });
            }
          }),
      );
    }

    await Promise.all(tasks);
    return out.filter((s) => {
      return s.href !== current;
    });
  }

  private async popularForRole(
    authUser: Admin,
    allowed: (section: ModuleSections | null) => boolean,
    visitedCount: Map<string, number>,
    current: string | null,
  ): Promise<Suggestion[]> {
    const roleId = this.roleIdOf(authUser);
    if (!roleId) {
      return [];
    }

    const rows = await this.usageModel.aggregate([
      {
        $match: {
          churchId: authUser.churchId,
          roleId,
          kind: UsageStatKind.PAGE,
          adminId: { $ne: authUser._id },
        },
      },
      {
        $group: { _id: '$key', total: { $sum: '$count' }, people: { $sum: 1 } },
      },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]);

    const out: Suggestion[] = [];
    for (const row of rows) {
      const page = findPage(row._id);
      if (
        !page ||
        !allowed(page.section) ||
        visitedCount.has(page.path) ||
        page.path === current
      ) {
        continue;
      }
      out.push({
        id: `popular_for_role:${page.path}`,
        type: 'popular_for_role',
        title: `Try ${page.label}`,
        message: `Others in your role find ${page.label} useful.`,
        href: page.path,
        priority: 30 + Math.min(row.people, 5),
      });
      if (out.length >= 2) {
        break;
      }
    }

    return out;
  }

  private roleIdOf(authUser: Admin): Types.ObjectId | null {
    const role = authUser.churchRole as unknown as Role | Types.ObjectId | null;
    if (!role) {
      return null;
    }
    return ((role as Role)._id ?? role) as Types.ObjectId;
  }
}
