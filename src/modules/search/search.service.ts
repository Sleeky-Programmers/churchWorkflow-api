import { FilterQuery, Model, Types } from 'mongoose';

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { searchRegex } from '../../common/helpers/regex.helper';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../common/utils/enums.utils';
import { hasSectionAccess } from '../../common/utils/permissions.util';
import { buildTenantFilter } from '../../common/utils/tenant-filter.util';
import { Admin } from '../../schemas/admin.schema';
import { Asset } from '../../schemas/asset.schema';
import { Department } from '../../schemas/department.schema';
import { Member } from '../../schemas/member.schema';
import { Role } from '../../schemas/role.schema';
import { SmallTeam } from '../../schemas/small-team.schema';

export type SearchGroup =
  | 'members'
  | 'departments'
  | 'smallTeams'
  | 'assets'
  | 'users';

export interface GlobalSearchResponse {
  q: string;
  /** True when at least one group failed or timed out and came back empty. */
  partial: boolean;
  /** A group is absent when the user's role can't view that section. */
  results: Partial<Record<SearchGroup, Record<string, any>[]>>;
}

/** Each lookup gives up after this long so one slow collection can't stall the box. */
const QUERY_TIMEOUT_MS = 800;

/**
 * One call behind the header search: looks up the core record types in
 * parallel, only those the role may view, with a small limit and only the
 * fields the results list shows. Archived guests are excluded by the Member
 * schema middleware.
 */
@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectModel(Member.name) private readonly memberModel: Model<Member>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<Department>,
    @InjectModel(SmallTeam.name)
    private readonly smallTeamModel: Model<SmallTeam>,
    @InjectModel(Asset.name) private readonly assetModel: Model<Asset>,
    @InjectModel(Admin.name) private readonly adminModel: Model<Admin>,
  ) {}

  async search(
    authUser: Admin,
    tenant: TenantContext,
    q: string,
    limit = 5,
  ): Promise<GlobalSearchResponse> {
    const role = authUser.churchRole as unknown as Role;
    const regex = searchRegex(q, 60);
    const can = (section: ModuleSections, level = AccessLevel.VIEW) => {
      return hasSectionAccess(role, section, level);
    };

    const lookups: [SearchGroup, () => Promise<Record<string, any>[]>][] = [];

    if (can(ModuleSections.MEMBERS)) {
      lookups.push([
        'members',
        () => {
          return this.memberModel
            .find({
              ...buildTenantFilter(tenant),
              $or: [
                { fullName: regex },
                { email: regex },
                { phoneNumber: regex },
              ],
            })
            .select('fullName phoneNumber membershipStatus')
            .sort({ fullName: 1 })
            .limit(limit)
            .maxTimeMS(QUERY_TIMEOUT_MS)
            .lean()
            .exec();
        },
      ]);
    }

    if (can(ModuleSections.DEPARTMENTS)) {
      const filter: FilterQuery<Department> = {
        ...buildTenantFilter(tenant),
        name: regex,
      };
      // Same visibility as the departments list: without full access you
      // Only see departments you head.
      if (!can(ModuleSections.DEPARTMENTS, AccessLevel.FULL_ACCESS)) {
        filter.$or = [{ hod: authUser._id }, { assistantHod: authUser._id }];
      }
      lookups.push([
        'departments',
        () => {
          return this.departmentModel
            .find(filter)
            .select('name')
            .sort({ name: 1 })
            .limit(limit)
            .maxTimeMS(QUERY_TIMEOUT_MS)
            .lean()
            .exec();
        },
      ]);
    }

    if (can(ModuleSections.SMALL_TEAMS)) {
      const filter: FilterQuery<SmallTeam> = {
        ...buildTenantFilter(tenant),
        name: regex,
      };
      // Same visibility as the small teams list: leaders see only their teams.
      if (!can(ModuleSections.SMALL_TEAMS, AccessLevel.FULL_ACCESS)) {
        filter.leaderId = authUser._id;
      }
      lookups.push([
        'smallTeams',
        () => {
          return this.smallTeamModel
            .find(filter)
            .select('name')
            .sort({ name: 1 })
            .limit(limit)
            .maxTimeMS(QUERY_TIMEOUT_MS)
            .lean()
            .exec();
        },
      ]);
    }

    if (can(ModuleSections.ASSETS)) {
      lookups.push([
        'assets',
        () => {
          return this.assetModel
            .find({
              ...buildTenantFilter(tenant),
              $or: [{ name: regex }, { tag: regex }, { category: regex }],
            })
            .select('name tag category')
            .sort({ name: 1 })
            .limit(limit)
            .maxTimeMS(QUERY_TIMEOUT_MS)
            .lean()
            .exec();
        },
      ]);
    }

    if (can(ModuleSections.ADMIN)) {
      lookups.push([
        'users',
        async () => {
          const admins = await this.adminModel
            .find({
              churchId: new Types.ObjectId(tenant.churchId),
              $or: [
                { firstName: regex },
                { lastName: regex },
                { email: regex },
              ],
            })
            .select('firstName lastName email')
            .sort({ firstName: 1 })
            .limit(limit)
            .maxTimeMS(QUERY_TIMEOUT_MS)
            .lean()
            .exec();
          return admins.map((a) => {
            return {
              _id: a._id,
              name: [a.firstName, a.lastName].filter(Boolean).join(' '),
              email: a.email,
            };
          });
        },
      ]);
    }

    const settled = await Promise.allSettled(
      lookups.map(([, run]) => {
        return run();
      }),
    );

    const results: GlobalSearchResponse['results'] = {};
    let partial = false;
    settled.forEach((outcome, i) => {
      const group = lookups[i][0];
      if (outcome.status === 'fulfilled') {
        results[group] = outcome.value;
      } else {
        partial = true;
        results[group] = [];
        this.logger.warn(
          `Global search "${group}" failed: ${outcome.reason?.message}`,
        );
      }
    });

    return { q, partial, results };
  }
}
