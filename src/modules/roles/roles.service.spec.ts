import { Types } from 'mongoose';

import { RoleType } from '../../common/utils/enums.utils';
import { RolesService, TIMER_ROLES } from './roles.service';

const churchId = new Types.ObjectId();

const system = (roleName: string) => ({ roleName, type: RoleType.SYSTEM, churchId: null });
const docs = [
  system('Super Admin'),
  system('Small Teams'),
  ...TIMER_ROLES.map((r) => system(r.roleName)),
  { roleName: 'Ushers', type: RoleType.CUSTOM, churchId },
];

/** Equality and $nin filters, as RolesService uses them. */
const matches = (d: any, q: any) =>
  Object.entries(q).every(([k, v]: [string, any]) =>
    v && typeof v === 'object' && '$nin' in v
      ? !v.$nin.includes(d[k])
      : String(d[k]) === String(v),
  );
const roleModel = {
  find: async (q: any) => docs.filter((d) => matches(d, q)),
  findOne: async (q: any) => docs.find((d) => matches(d, q)) ?? null,
};

describe('RolesService', () => {
  const service = new RolesService(roleModel as any);

  it("keeps the Service Timer's roles out of Church Workflow's role list", async () => {
    const names = (await service.fetchRoles({ churchId } as any)).map(
      (r: any) => r.roleName,
    );
    expect(names).toEqual(['Super Admin', 'Small Teams', 'Ushers']);
  });

  it('still finds a timer role for the timer, by name', async () => {
    expect(await service.findSystemRole('Timer Operator')).toMatchObject({
      roleName: 'Timer Operator',
      type: RoleType.SYSTEM,
    });
  });

  it("ignores a church's own role that happens to share the name", async () => {
    docs.push({ roleName: 'Timer Viewer', type: RoleType.CUSTOM, churchId });
    expect((await service.findSystemRole('Timer Viewer'))?.type).toBe(
      RoleType.SYSTEM,
    );
  });
});
