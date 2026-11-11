import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import {
  AccessLevel,
  AdminAccessScope,
  ModuleSections,
} from '../../common/utils/enums.utils';
import { roleHasAccess } from '../../common/utils/role-access.util';
import { Admin } from '../../schemas/admin.schema';
import { Branch } from '../../schemas/branch.schema';
import { Church } from '../../schemas/church.schema';
import {
  ReportDigestFrequency,
  ReportProfile,
} from '../../schemas/report-profile.schema';
import {
  ReportPeriod,
  ReportSnapshot,
} from '../../schemas/report-snapshot.schema';
import { Role } from '../../schemas/role.schema';
import { SavePreferencesDto } from './dto/reports.dto';
import {
  isClosed,
  makeRange,
  parseDateStr,
  previousCustomRange,
  previousPeriodRange,
  rangeContaining,
  recentPeriods,
} from './reports.periods';
import {
  ReportSectionsService,
  SECTION_DEFS,
  SECTION_KEYS,
} from './reports.sections';
import {
  ReportRange,
  ReportScope,
  SectionDef,
  SectionResult,
} from './reports.types';

export interface ReportBundle {
  title: string;
  churchName: string;
  scopeLabel: string;
  period: ReportPeriod | 'custom';
  range: ReportRange;
  previousRange: ReportRange;
  sections: SectionResult[];
  generatedAt: Date;
}

const MAX_CUSTOM_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(ReportProfile.name)
    private profileModel: Model<ReportProfile>,
    @InjectModel(ReportSnapshot.name)
    private snapshotModel: Model<ReportSnapshot>,
    @InjectModel(Branch.name) private branchModel: Model<Branch>,
    @InjectModel(Church.name) private churchModel: Model<Church>,
    private readonly sections: ReportSectionsService,
  ) {}

  // ---------------------------------------------------------------------
  // Scope and section selection
  // ---------------------------------------------------------------------

  async resolveScope(
    tenant: TenantContext,
    branchParam?: string,
  ): Promise<ReportScope> {
    const accessible = tenant.accessibleBranchIds ?? [];
    const isOrgWide = tenant.accessScope === AdminAccessScope.ORG_WIDE;
    const wantsAll =
      branchParam === 'all' || (!branchParam && !tenant.branchId);

    if (wantsAll) {
      if (isOrgWide) {
        return {
          churchId: tenant.churchId,
          branchIds: null,
          snapshotBranchId: null,
          label: 'All branches',
        };
      }
      return {
        churchId: tenant.churchId,
        branchIds: accessible,
        snapshotBranchId: accessible.length === 1 ? accessible[0] : undefined,
        label:
          accessible.length === 1
            ? await this.branchName(accessible[0])
            : 'All my branches',
      };
    }

    const wanted = branchParam
      ? this.toObjectId(branchParam)
      : (tenant.branchId as Types.ObjectId);
    if (
      !accessible.some((id) => {
        return id.equals(wanted);
      })
    ) {
      throw new ForbiddenException('You do not have access to that branch.');
    }

    return {
      churchId: tenant.churchId,
      branchIds: [wanted],
      snapshotBranchId: wanted,
      label: await this.branchName(wanted),
    };
  }

  private async branchName(id: Types.ObjectId): Promise<string> {
    const branch = await this.branchModel.findById(id).select('name').lean();
    return (branch as any)?.name ?? 'Branch';
  }

  private toObjectId(value: string): Types.ObjectId {
    if (!Types.ObjectId.isValid(value)) {
      throw new BadRequestException('Invalid branch.');
    }
    return new Types.ObjectId(value);
  }

  permittedDefs(role: Role | null | undefined): SectionDef[] {
    return SECTION_DEFS.filter((d) => {
      return roleHasAccess(role, d.permission);
    });
  }

  async includedDefs(
    authUser: Admin,
    requested?: string[],
  ): Promise<SectionDef[]> {
    const role = authUser.churchRole as unknown as Role;
    let defs = this.permittedDefs(role);

    if (requested && requested.length) {
      const wanted = new Set(requested);
      defs = defs.filter((d) => {
        return wanted.has(d.key);
      });
    } else {
      const excluded = await this.excludedFor(authUser);
      defs = defs.filter((d) => {
        return !excluded.has(d.key);
      });
    }

    return defs;
  }

  private async excludedFor(authUser: Admin): Promise<Set<string>> {
    const profiles = await this.profileModel
      .find({
        churchId: authUser.churchId,
        adminId: { $in: [null, authUser._id] },
      })
      .lean();

    const church = profiles.find((p) => {
      return p.adminId === null;
    });
    const personal = profiles.find((p) => {
      return p.adminId !== null;
    });

    const source =
      personal && personal.overridesChurchDefault ? personal : church;
    return new Set(source?.excludedSections ?? []);
  }

  // ---------------------------------------------------------------------
  // Snapshots
  // ---------------------------------------------------------------------

  /**
   * Closed periods are read from (and written to) frozen snapshots; the
   * period in progress is always computed live.
   */
  async sectionsFor(
    scope: ReportScope,
    period: ReportPeriod | 'custom',
    range: ReportRange,
  ): Promise<Record<string, SectionResult>> {
    const storable =
      period !== 'custom' &&
      scope.snapshotBranchId !== undefined &&
      isClosed(range);

    if (!storable) {
      return this.sections.computeAll(scope, range);
    }

    const key = {
      churchId: scope.churchId,
      branchId: scope.snapshotBranchId,
      period,
      periodStart: range.startStr,
    };

    const existing = await this.snapshotModel.findOne(key).lean();
    if (existing) {
      return existing.sections as Record<string, SectionResult>;
    }

    const computed = await this.sections.computeAll(scope, range);
    await this.snapshotModel.updateOne(
      key,
      {
        $setOnInsert: {
          periodEnd: range.endStr,
          sections: computed,
          generatedAt: new Date(),
        },
      },
      { upsert: true },
    );
    return computed;
  }

  private applyDeltas(
    current: Record<string, SectionResult>,
    previous: Record<string, SectionResult> | undefined,
  ) {
    if (!previous) {
      return;
    }

    for (const [key, section] of Object.entries(current)) {
      const before = previous[key];
      if (!before) {
        continue;
      }

      const prevByKey = new Map(
        before.metrics.map((m) => {
          return [m.key, m.value];
        }),
      );
      for (const m of section.metrics) {
        const prev = prevByKey.get(m.key) ?? 0;
        m.previous = prev;
        m.changePct =
          prev === 0
            ? null
            : Math.round(((m.value - prev) / Math.abs(prev)) * 1000) / 10;
      }
    }
  }

  private pick(
    data: Record<string, SectionResult>,
    defs: SectionDef[],
  ): Record<string, SectionResult> {
    return Object.fromEntries(
      defs
        .filter((d) => {
          return data[d.key];
        })
        .map((d) => {
          return [d.key, data[d.key]];
        }),
    );
  }

  // ---------------------------------------------------------------------
  // Feed and summaries
  // ---------------------------------------------------------------------

  async feed(
    authUser: Admin,
    tenant: TenantContext,
    period: ReportPeriod,
    count = period === ReportPeriod.WEEKLY ? 8 : 6,
    branch?: string,
  ) {
    const scope = await this.resolveScope(tenant, branch);
    const defs = await this.includedDefs(authUser);

    // One extra, older period is loaded only to compare against.
    const ranges = recentPeriods(period, count + 1);
    const loaded: Record<string, SectionResult>[] = [];
    for (const range of ranges) {
      loaded.push(await this.sectionsFor(scope, period, range));
    }

    const periods = ranges.slice(1).map((range, i) => {
      const data = this.pick(loaded[i + 1], defs);
      this.applyDeltas(data, this.pick(loaded[i], defs));
      return {
        start: range.startStr,
        end: range.endStr,
        label: range.label,
        isCurrent: !isClosed(range),
        sections: data,
      };
    });

    return {
      period,
      scope: { label: scope.label },
      sections: defs.map(({ key, title, group, description }) => {
        return {
          key,
          title,
          group,
          description,
        };
      }),
      periods,
    };
  }

  async buildBundle(
    authUser: Admin,
    tenant: TenantContext,
    opts: {
      period?: ReportPeriod | 'custom';
      anchor?: string;
      from?: string;
      to?: string;
      sections?: string[];
      branch?: string;
    },
  ): Promise<ReportBundle> {
    const scope = await this.resolveScope(tenant, opts.branch);
    const defs = await this.includedDefs(authUser, opts.sections);
    return this.assembleBundle(scope, defs, opts);
  }

  async assembleBundle(
    scope: ReportScope,
    defs: SectionDef[],
    opts: {
      period?: ReportPeriod | 'custom';
      anchor?: string;
      from?: string;
      to?: string;
    },
  ): Promise<ReportBundle> {
    if (!defs.length) {
      throw new BadRequestException(
        'There are no report sections available for this selection.',
      );
    }

    const period = opts.period ?? ReportPeriod.WEEKLY;
    let range: ReportRange;
    let previousRange: ReportRange;

    if (period === 'custom') {
      if (!opts.from || !opts.to) {
        throw new BadRequestException('Choose a start and end date.');
      }
      const start = parseDateStr(opts.from);
      const end = parseDateStr(opts.to);
      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(end.getTime()) ||
        end < start
      ) {
        throw new BadRequestException(
          'The end date must come after the start date.',
        );
      }
      if ((end.getTime() - start.getTime()) / DAY_MS > MAX_CUSTOM_DAYS) {
        throw new BadRequestException('Choose a range of a year or less.');
      }
      range = makeRange(start, end);
      previousRange = previousCustomRange(range);
    } else {
      const anchor = opts.anchor ? parseDateStr(opts.anchor) : new Date();
      if (Number.isNaN(anchor.getTime())) {
        throw new BadRequestException('Invalid date.');
      }
      range = rangeContaining(period, anchor);
      previousRange = previousPeriodRange(period, range);
    }

    const [current, previous, church] = await Promise.all([
      this.sectionsFor(scope, period, range),
      this.sectionsFor(scope, period, previousRange),
      this.churchModel.findById(scope.churchId).select('name').lean(),
    ]);

    const data = this.pick(current, defs);
    this.applyDeltas(data, this.pick(previous, defs));

    const kind =
      period === 'custom'
        ? 'Report'
        : period === 'weekly'
          ? 'Weekly report'
          : 'Monthly report';

    return {
      title: `${kind}: ${range.label}`,
      churchName: (church as any)?.name ?? 'Church',
      scopeLabel: scope.label,
      period,
      range,
      previousRange,
      sections: defs
        .map((d) => {
          return data[d.key];
        })
        .filter(Boolean),
      generatedAt: new Date(),
    };
  }

  async summary(
    authUser: Admin,
    tenant: TenantContext,
    query: {
      period?: ReportPeriod | 'custom';
      anchor?: string;
      from?: string;
      to?: string;
      sections?: string;
      branch?: string;
    },
  ) {
    const requested = query.sections
      ? query.sections
          .split(',')
          .map((s) => {
            return s.trim();
          })
          .filter(Boolean)
      : undefined;
    const bundle = await this.buildBundle(authUser, tenant, {
      ...query,
      sections: requested,
    });
    return {
      title: bundle.title,
      scope: { label: bundle.scopeLabel },
      period: bundle.period,
      range: {
        start: bundle.range.startStr,
        end: bundle.range.endStr,
        label: bundle.range.label,
      },
      previousRange: {
        start: bundle.previousRange.startStr,
        end: bundle.previousRange.endStr,
        label: bundle.previousRange.label,
      },
      sections: bundle.sections,
    };
  }

  // ---------------------------------------------------------------------
  // Preferences
  // ---------------------------------------------------------------------

  async getPreferences(authUser: Admin) {
    const role = authUser.churchRole as unknown as Role;
    const permitted = new Set(
      this.permittedDefs(role).map((d) => {
        return d.key;
      }),
    );

    const profiles = await this.profileModel
      .find({
        churchId: authUser.churchId,
        adminId: { $in: [null, authUser._id] },
      })
      .lean();
    const church = profiles.find((p) => {
      return p.adminId === null;
    });
    const personal = profiles.find((p) => {
      return p.adminId !== null;
    });
    const excluded = await this.excludedFor(authUser);

    return {
      sections: SECTION_DEFS.map(({ key, title, group, description }) => {
        return {
          key,
          title,
          group,
          description,
          permitted: permitted.has(key),
        };
      }),
      church: { excludedSections: church?.excludedSections ?? [] },
      personal: {
        useChurchDefault: !personal?.overridesChurchDefault,
        excludedSections: personal?.excludedSections ?? [],
        digestFrequency:
          personal?.digestFrequency ?? ReportDigestFrequency.NONE,
      },
      effectiveIncluded: [...permitted].filter((k) => {
        return !excluded.has(k);
      }),
      canEditChurch: this.canEditChurch(role),
    };
  }

  async savePreferences(authUser: Admin, dto: SavePreferencesDto) {
    const unknown = (dto.excludedSections ?? []).filter((k) => {
      return !SECTION_KEYS.includes(k);
    });
    if (unknown.length) {
      throw new BadRequestException(`Unknown report section: ${unknown[0]}`);
    }

    if (dto.scope === 'church') {
      if (!this.canEditChurch(authUser.churchRole as unknown as Role)) {
        throw new ForbiddenException(
          'Only admins who manage users and settings can change the church default.',
        );
      }
      await this.profileModel.updateOne(
        { churchId: authUser.churchId, adminId: null },
        { $set: { excludedSections: dto.excludedSections ?? [] } },
        { upsert: true },
      );
    } else {
      const set: Record<string, unknown> = {};
      if (dto.useChurchDefault !== undefined) {
        set.overridesChurchDefault = !dto.useChurchDefault;
      }
      if (dto.excludedSections) {
        set.excludedSections = dto.excludedSections;
        if (dto.useChurchDefault === undefined) {
          set.overridesChurchDefault = true;
        }
      }
      if (dto.digestFrequency) {
        set.digestFrequency = dto.digestFrequency;
      }
      await this.profileModel.updateOne(
        { churchId: authUser.churchId, adminId: authUser._id },
        { $set: set },
        { upsert: true },
      );
    }

    return this.getPreferences(authUser);
  }

  private canEditChurch(role: Role | null | undefined): boolean {
    return roleHasAccess(role, ModuleSections.ADMIN, AccessLevel.MANAGE);
  }
}
