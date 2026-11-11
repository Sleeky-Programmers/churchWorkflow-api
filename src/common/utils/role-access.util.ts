import { Role } from '../../schemas/role.schema';
import {
  AccessLevel,
  ModuleSections,
  RoleStatus,
  RoleType,
} from './enums.utils';

const LEVEL_RANK: Record<AccessLevel, number> = {
  [AccessLevel.NO_ACCESS]: 0,
  [AccessLevel.VIEW]: 1,
  [AccessLevel.MANAGE]: 2,
  [AccessLevel.FULL_ACCESS]: 3,
};

/**
 * Mirrors PermissionsGuard for code that has to decide access itself (for
 * example filtering which report sections or suggestions a person may see).
 */
export function roleHasAccess(
  role: Role | null | undefined,
  section: ModuleSections,
  required: AccessLevel = AccessLevel.VIEW,
): boolean {
  if (!role || role.status === RoleStatus.DISABLED) {
    return false;
  }

  if (role.type === RoleType.SYSTEM && role.roleName === 'Super Admin') {
    return true;
  }

  const permission = role.permissions?.find((p) => {
    return p.moduleSection === section;
  });
  if (!permission) {
    return false;
  }

  return LEVEL_RANK[permission.accessLevel] >= LEVEL_RANK[required];
}
