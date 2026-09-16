import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantContext } from '../interfaces/tenant-context.interface';

export const CurrentTenant = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.user?.tenant;

    if (!tenant) {
      throw new UnauthorizedException('Tenant context not resolved');
    }

    return tenant;
  },
);
