import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { AccessLevel, ModuleSections } from '../../../common/utils/enums.utils';
import { Admin } from '../../../schemas/admin.schema';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import {
  TIMER_ROLE_KEYS,
  TimerRoleKey,
  TimerTeamService,
} from './timer-team.service';

export class TimerInviteDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  lastName?: string;

  @IsIn(TIMER_ROLE_KEYS)
  role: TimerRoleKey;
}

export class TimerRoleDto {
  @IsIn(TIMER_ROLE_KEYS)
  role: TimerRoleKey;
}

const FULL = {
  section: ModuleSections.SERVICE_TIMER,
  level: AccessLevel.FULL_ACCESS,
};

/**
 * The timer's Team page: timer admins invite people as Timer Admin,
 * Operator or Viewer, resend or cancel invites, and change or remove
 * members who have a Timer role. Invites are emailed with a link to the
 * timer app's /accept-invite page.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(FULL)
@Controller('service-timer/team')
export class TimerTeamController {
  constructor(private readonly team: TimerTeamService) {}

  @Get()
  list(@AuthUser() admin: Admin) {
    return this.team.list(admin);
  }

  @Post('invites')
  invite(@AuthUser() admin: Admin, @Body() dto: TimerInviteDto) {
    return this.team.invite(admin, dto);
  }

  @Post('invites/:id/resend')
  @HttpCode(200)
  resend(@AuthUser() admin: Admin, @Param('id') id: string) {
    return this.team.resend(admin, id);
  }

  @Delete('invites/:id')
  cancel(@AuthUser() admin: Admin, @Param('id') id: string) {
    return this.team.cancel(admin, id);
  }

  @Put('members/:id/role')
  changeRole(
    @AuthUser() admin: Admin,
    @Param('id') id: string,
    @Body() dto: TimerRoleDto,
  ) {
    return this.team.changeRole(admin, id, dto.role);
  }

  @Delete('members/:id')
  remove(@AuthUser() admin: Admin, @Param('id') id: string) {
    return this.team.remove(admin, id);
  }
}
