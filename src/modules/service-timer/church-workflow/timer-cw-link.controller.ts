import { Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';

import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantContext } from '../../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../../common/utils/enums.utils';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { ServiceTimerService } from '../service-timer.service';
import { TimerChurchWorkflowService } from './timer-cw-link.service';

const VIEW = { section: ModuleSections.SERVICE_TIMER, level: AccessLevel.VIEW };
const FULL = {
  section: ModuleSections.SERVICE_TIMER,
  level: AccessLevel.FULL_ACCESS,
};

/**
 * The Service Timer's link to Church Workflow. Opening Church Workflow
 * signed in uses POST /auth/handoff for a one-time code.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('service-timer/church-workflow')
export class TimerChurchWorkflowController {
  constructor(
    private readonly link: TimerChurchWorkflowService,
    private readonly timer: ServiceTimerService,
  ) {}

  @Get()
  @RequirePermissions(VIEW)
  status(@CurrentTenant() tenant: TenantContext) {
    return this.link.status(tenant.churchId);
  }

  /** Starts the Church Workflow trial (timer admins). */
  @Post('start')
  @HttpCode(200)
  @RequirePermissions(FULL)
  start(@CurrentTenant() tenant: TenantContext) {
    return this.link.start(tenant.churchId);
  }

  @Get('services')
  @RequirePermissions(VIEW)
  services(@CurrentTenant() tenant: TenantContext) {
    return this.link.upcomingServices(this.timer.scopeFor(tenant));
  }
}
