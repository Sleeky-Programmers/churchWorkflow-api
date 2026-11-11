import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantContext } from '../../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../../common/utils/enums.utils';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { ServiceTimerService } from '../service-timer.service';
import { TimerReportsService } from './timer-reports.service';

/** Service reports for the active branch (signed-in timer users). */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions({
  section: ModuleSections.SERVICE_TIMER,
  level: AccessLevel.VIEW,
})
@Controller('service-timer/reports')
export class TimerReportsController {
  constructor(
    private readonly reports: TimerReportsService,
    private readonly timer: ServiceTimerService,
  ) {}

  @Get()
  list(@CurrentTenant() tenant: TenantContext, @Query('days') days?: string) {
    const d = Math.min(Math.max(Number(days) || 90, 1), 366);
    return this.reports.listServices(this.timer.scopeFor(tenant), d);
  }

  @Get(':date')
  service(@CurrentTenant() tenant: TenantContext, @Param('date') date: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('Use a date like 2026-11-09.');
    }
    return this.reports.service(this.timer.scopeFor(tenant), date);
  }
}
