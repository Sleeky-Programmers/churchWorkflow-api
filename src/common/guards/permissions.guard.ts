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
import { AccessLevel, RoleStatus, RoleType } from '../utils/enums.utils';
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
    // that nominally have permissions in their array.
    if (role.status === RoleStatus.DISABLED) {
      throw new ForbiddenException(
        'Access denied. Your assigned role has been disabled.',
      );
    }

    if (role.type === RoleType.SYSTEM && role.roleName === 'Super Admin') {
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

      return this.hasSufficientAccess(userPerm.accessLevel, requiredPerm.level);
    });

    if (!hasPermission) {
      throw new ForbiddenException(
        'You do not have permission to perform this action.',
      );
    }

    return true;
  }

  private hasSufficientAccess(
    userAccess: AccessLevel,
    requiredAccess: AccessLevel,
  ): boolean {
    const accessHierarchy = {
      [AccessLevel.NO_ACCESS]: 0,
      [AccessLevel.VIEW]: 1,
      [AccessLevel.MANAGE]: 2,
      [AccessLevel.FULL_ACCESS]: 3,
    };

    return accessHierarchy[userAccess] >= accessHierarchy[requiredAccess];
  }
}
