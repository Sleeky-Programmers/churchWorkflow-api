import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Admin } from '../../schemas/admin.schema';
import { ProductAdmin } from '../../schemas/product-admin.schema';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { RoleType } from '../utils/enums.utils';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context
      .switchToHttp()
      .getRequest<{ user: Admin | ProductAdmin }>();

    if (!user) {
      throw new ForbiddenException('Access denied. User not found.');
    }

    let userRoleName: string | null = null;
    let isSuperAdmin = false;

    if ('role' in user && user.role) {
      const role = user.role as any;
      // If role is populated, get the name
      if (typeof role === 'object' && role.name) {
        userRoleName = role.name;
        isSuperAdmin = role.name === 'SUPER_ADMIN';
      } else if (typeof role === 'string') {
        userRoleName = 'SUPER_ADMIN'; // Fallback
        isSuperAdmin = true;
      }
    } else if ('churchRole' in user && user.churchRole) {
      const role = user.churchRole as any;
      if (typeof role === 'object' && role.roleName) {
        userRoleName = role.roleName;
        isSuperAdmin =
          role.type === RoleType.SYSTEM && role.roleName === 'Super Admin';
      }
    } else if ('name' in user && user.name) {
      userRoleName = user.name;
      isSuperAdmin = user.name === 'SUPER_ADMIN';
    }

    // Super Admin has full access
    if (isSuperAdmin) {
      return true;
    }

    if (!userRoleName) {
      throw new ForbiddenException('Access denied. No assigned role.');
    }

    // Check if the user has any of the required roles
    const hasRole = requiredRoles.some((requiredRole) => {
      return (
        userRoleName &&
        userRoleName.toUpperCase() === requiredRole.toUpperCase()
      );
    });

    if (!hasRole) {
      throw new ForbiddenException(
        `You do not have the required role to perform this action. Required: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
