import { Types } from 'mongoose';

import { escapeRegex, searchRegex } from '../../common/helpers/regex.helper';
import {
  AccessLevel,
  AdminAccessScope,
  ModuleSections,
  RoleStatus,
  RoleType,
} from '../../common/utils/enums.utils';
import { SearchService } from './search.service';

const tenant = {
  churchId: new Types.ObjectId(),
  branchId: new Types.ObjectId(),
  accessScope: AdminAccessScope.BRANCH,
  accessibleBranchIds: [],
} as any;

/** A chainable fake query that records its filter and resolves to `rows`. */
function fakeModel(rows: any[] | Error) {
  const calls: any[] = [];
  const model: any = {
    calls,
    find: jest.fn((filter: any) => {
      calls.push(filter);
      const chain: any = {
        select: () => chain,
        sort: () => chain,
        limit: (n: number) => {
          chain.limitN = n;
          return chain;
        },
        maxTimeMS: () => chain,
        lean: () => chain,
        exec: async () => {
          if (rows instanceof Error) throw rows;
          return rows.slice(0, chain.limitN ?? rows.length);
        },
      };
      return chain;
    }),
  };
  return model;
}

function role(perms: Partial<Record<ModuleSections, AccessLevel>>, extra = {}) {
  return {
    type: RoleType.CUSTOM,
    roleName: 'Usher',
    status: RoleStatus.ACTIVE,
    permissions: Object.entries(perms).map(([moduleSection, accessLevel]) => ({
      moduleSection,
      accessLevel,
    })),
    ...extra,
  };
}

function build(models: Partial<Record<string, any>> = {}) {
  const m = {
    member: models.member ?? fakeModel([{ fullName: 'Ada Obi' }]),
    department: models.department ?? fakeModel([{ name: 'Adult Choir' }]),
    team: models.team ?? fakeModel([{ name: 'Ada cell' }]),
    asset: models.asset ?? fakeModel([{ name: 'Adapter' }]),
    admin:
      models.admin ??
      fakeModel([{ _id: 'u1', firstName: 'Ada', lastName: 'Eze', email: 'a@x' }]),
  };
  const service = new SearchService(m.member, m.department, m.team, m.asset, m.admin);
  return { service, ...m };
}

describe('escapeRegex', () => {
  it('matches user input literally', () => {
    const pattern = new RegExp(escapeRegex('a.*('), 'i');
    expect(pattern.test('xa.*(y')).toBe(true);
    expect(pattern.test('abc')).toBe(false);
    expect(new RegExp(escapeRegex('+234')).test('+2348012345678')).toBe(true);
  });

  it('caps length and trims', () => {
    expect(searchRegex('  ada  ').$regex).toBe('ada');
    expect(searchRegex('x'.repeat(200), 60).$regex).toHaveLength(60);
  });
});

describe('SearchService', () => {
  it('searches only the sections the role can view', async () => {
    const { service, asset, admin } = build();
    const user: any = {
      _id: new Types.ObjectId(),
      churchRole: role({
        [ModuleSections.MEMBERS]: AccessLevel.VIEW,
        [ModuleSections.DEPARTMENTS]: AccessLevel.FULL_ACCESS,
        [ModuleSections.ASSETS]: AccessLevel.NO_ACCESS,
      }),
    };

    const res = await service.search(user, tenant, 'ada', 5);

    expect(Object.keys(res.results).sort()).toEqual(['departments', 'members']);
    expect(asset.find).not.toHaveBeenCalled();
    expect(admin.find).not.toHaveBeenCalled();
    expect(res.partial).toBe(false);
  });

  it('gives Super Admin every group', async () => {
    const { service } = build();
    const user: any = {
      _id: new Types.ObjectId(),
      churchRole: { type: RoleType.SYSTEM, roleName: 'Super Admin', permissions: [] },
    };
    const res = await service.search(user, tenant, 'ada', 5);
    expect(Object.keys(res.results).sort()).toEqual([
      'assets',
      'departments',
      'members',
      'smallTeams',
      'users',
    ]);
    expect(res.results.users?.[0]).toEqual({ _id: 'u1', name: 'Ada Eze', email: 'a@x' });
  });

  it('scopes to the tenant, escapes the query and limits results', async () => {
    const member = fakeModel(Array.from({ length: 9 }, (_, i) => ({ fullName: `P${i}` })));
    const { service } = build({ member });
    const user: any = {
      _id: new Types.ObjectId(),
      churchRole: role({ [ModuleSections.MEMBERS]: AccessLevel.VIEW }),
    };

    const res = await service.search(user, tenant, 'a.*(', 3);

    const filter = member.calls[0];
    expect(filter.churchId).toEqual(tenant.churchId);
    expect(filter.branchId).toEqual(tenant.branchId);
    expect(filter.$or[0].fullName.$regex).toBe('a\\.\\*\\(');
    expect(res.results.members).toHaveLength(3);
  });

  it('limits departments to the ones you head without full access', async () => {
    const { service, department } = build();
    const userId = new Types.ObjectId();
    const user: any = {
      _id: userId,
      churchRole: role({ [ModuleSections.DEPARTMENTS]: AccessLevel.VIEW }),
    };
    await service.search(user, tenant, 'choir', 5);
    expect(department.calls[0].$or).toEqual([{ hod: userId }, { assistantHod: userId }]);
  });

  it('returns other groups when one lookup fails', async () => {
    const { service } = build({ asset: fakeModel(new Error('timeout')) });
    const user: any = {
      _id: new Types.ObjectId(),
      churchRole: role({
        [ModuleSections.MEMBERS]: AccessLevel.VIEW,
        [ModuleSections.ASSETS]: AccessLevel.VIEW,
      }),
    };
    const res = await service.search(user, tenant, 'ada', 5);
    expect(res.partial).toBe(true);
    expect(res.results.assets).toEqual([]);
    expect(res.results.members).toHaveLength(1);
  });

  it('a disabled role sees nothing', async () => {
    const { service, member } = build();
    const user: any = {
      _id: new Types.ObjectId(),
      churchRole: role(
        { [ModuleSections.MEMBERS]: AccessLevel.FULL_ACCESS },
        { status: RoleStatus.DISABLED },
      ),
    };
    const res = await service.search(user, tenant, 'ada', 5);
    expect(res.results).toEqual({});
    expect(member.find).not.toHaveBeenCalled();
  });
});
