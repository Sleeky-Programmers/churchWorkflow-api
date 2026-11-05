import { Role } from '../../schemas/role.schema';
import {
  AccessLevel,
  ModuleSections,
  RoleStatus,
  RoleType,
} from './enums.utils';

const ACCESS_RANK: Record<AccessLevel, number> = {
  [AccessLevel.NO_ACCESS]: 0,
  [AccessLevel.VIEW]: 1,
  [AccessLevel.MANAGE]: 2,
  [AccessLevel.FULL_ACCESS]: 3,
};

export function hasSufficientAccess(
  userAccess: AccessLevel,
  requiredAccess: AccessLevel,
): boolean {
  return (ACCESS_RANK[userAccess] ?? 0) >= ACCESS_RANK[requiredAccess];
}

export function isSuperAdminRole(role?: Partial<Role> | null): boolean {
  return role?.type === RoleType.SYSTEM && role?.roleName === 'Super Admin';
}

/**
 * Same rule as PermissionsGuard, for code that needs to check a section
 * without throwing (e.g. global search skips sections the role can't see).
 * Fails closed: no role, a disabled role, or no entry for the section = no.
 */
export function hasSectionAccess(
  role: Partial<Role> | null | undefined,
  section: ModuleSections,
  level: AccessLevel = AccessLevel.VIEW,
): boolean {
  if (!role || role.status === RoleStatus.DISABLED) {
    return false;
  }
  if (isSuperAdminRole(role)) {
    return true;
  }
  const entry = role.permissions?.find((p) => p.moduleSection === section);
  return !!entry && hasSufficientAccess(entry.accessLevel, level);
}
