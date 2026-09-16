import { ExtractJwt, Strategy } from 'passport-jwt';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { AdminService } from '../../admin/admin.service';
import { TenantContextService } from '../../branch/tenant-context.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private adminService: AdminService,
    private tenantContextService: TenantContextService,
    private configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: any) {
    const user = await this.adminService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Admins created but not yet attached to a Church (mid-onboarding) have
    // No tenant to resolve - every downstream route that needs one will
    // Fail on its own terms rather than here.
    if (user.churchId) {
      (user as any).tenant =
        await this.tenantContextService.resolveTenantContext(
          user,
          payload.activeBranchId,
        );
    }

    return user;
  }
}
