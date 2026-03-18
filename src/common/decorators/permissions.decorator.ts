import { SetMetadata } from '@nestjs/common';
import { ModuleSections, AccessLevel } from '../utils/enums.utils';

export const PERMISSIONS_KEY = 'permissions';

export interface PermissionRequirement {
  section: ModuleSections;
  level: AccessLevel;
}

export const RequirePermissions = (...permissions: PermissionRequirement[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
