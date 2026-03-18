import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Admin } from '../../schemas/admin.schema';
import { Role } from '../../schemas/role.schema';
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

    const { user } = context.switchToHttp().getRequest<{ user: Admin }>();

    if (!user || !user.churchRole) {
      throw new ForbiddenException('Access denied. No assigned role.');
    }

    const role = user.churchRole as unknown as Role;

    if (role.type === RoleType.SYSTEM && role.roleName === 'Super Admin') {
      return true;
    }

    const hasRole = requiredRoles.includes(role.roleName);

    if (!hasRole) {
      throw new ForbiddenException(
        'You do not have the required role to perform this action.',
      );
    }

    return true;
  }
}
