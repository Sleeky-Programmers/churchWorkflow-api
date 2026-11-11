import { IsString, MaxLength } from 'class-validator';

import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { AuthHandoffService } from './auth-handoff.service';

export class RedeemHandoffDto {
  @IsString()
  @MaxLength(100)
  code: string;
}

@Controller('auth/handoff')
export class AuthHandoffController {
  constructor(private readonly handoffs: AuthHandoffService) {}

  /** A one-time code for opening another of our apps already signed in. */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@AuthUser() admin: Admin) {
    // No tenant yet for someone still setting up their church.
    const tenant = (admin as Admin & { tenant?: TenantContext }).tenant;
    return this.handoffs.create(admin, tenant?.branchId ?? null);
  }

  /** The other app trades the code for tokens (no login needed). */
  @Post('redeem')
  @HttpCode(200)
  redeem(@Body() dto: RedeemHandoffDto) {
    return this.handoffs.redeem(dto.code);
  }
}
