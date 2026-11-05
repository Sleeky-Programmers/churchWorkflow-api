import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  PermissionRequirement,
} from '../decorators/permissions.decorator';
import { RoleStatus } from '../utils/enums.utils';
import {
  hasSufficientAccess,
  isSuperAdminRole,
} from '../utils/permissions.util';
import { Admin } from '../../schemas/admin.schema';
import { Role } from '../../schemas/role.schema';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<
      PermissionRequirement[]
    >(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<{ user: Admin }>();

    if (!user || !user.churchRole) {
      throw new ForbiddenException('Access denied. No assigned role.');
    }

    const role = user.churchRole as unknown as Role;

    // A role that has been disabled must not be usable, even for sections
    // That nominally have permissions in their array.
    if (role.status === RoleStatus.DISABLED) {
      throw new ForbiddenException(
        'Access denied. Your assigned role has been disabled.',
      );
    }

    if (isSuperAdminRole(role)) {
      return true;
    }

    const hasPermission = requiredPermissions.every((requiredPerm) => {
      const userPerm = role.permissions?.find(
        (p) => p.moduleSection === requiredPerm.section,
      );

      // Fail closed: no explicit permission entry means no access.
      if (!userPerm) {
        return false;
      }

      return hasSufficientAccess(userPerm.accessLevel, requiredPerm.level);
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }

    return true;
  }
}
