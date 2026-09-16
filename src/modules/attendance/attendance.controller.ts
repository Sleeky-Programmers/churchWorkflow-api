import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Admin } from '../../schemas/admin.schema';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ModuleSections, AccessLevel } from '../../common/utils/enums.utils';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('mark')
  @RequirePermissions({
    section: ModuleSections.ATTENDANCE,
    level: AccessLevel.MANAGE,
  })
  markAttendance(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Query('serviceId') serviceId: string,
    @Body() createAttendanceDto: CreateAttendanceDto,
  ) {
    return this.attendanceService.markAttendance(
      authUser,
      tenant,
      serviceId,
      createAttendanceDto,
    );
  }

  @Post('mark-absent')
  @RequirePermissions({
    section: ModuleSections.ATTENDANCE,
    level: AccessLevel.MANAGE,
  })
  markAsAbsent(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Query('serviceId') serviceId: string,
    @Body() createAttendanceDto: CreateAttendanceDto,
  ) {
    return this.attendanceService.markAsAbsent(
      authUser,
      tenant,
      serviceId,
      createAttendanceDto,
    );
  }

  @Get()
  @RequirePermissions({
    section: ModuleSections.ATTENDANCE,
    level: AccessLevel.VIEW,
  })
  async getAttendance(
    @CurrentTenant() tenant: TenantContext,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getAttendance(tenant, serviceId, date);
  }

  @Get('member/:memberId')
  async getMemberAttendanceHistory(
    @CurrentTenant() tenant: TenantContext,
    @Param('memberId') memberId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.getMemberAttendanceHistory(
      tenant,
      memberId,
      from,
      to,
    );
  }

  @Get('stats')
  @RequirePermissions({
    section: ModuleSections.ATTENDANCE,
    level: AccessLevel.VIEW,
  })
  async getAttendanceStats(@CurrentTenant() tenant: TenantContext) {
    return this.attendanceService.getAttendanceStats(tenant);
  }

  @Get('trend')
  async getAttendanceTrend(
    @CurrentTenant() tenant: TenantContext,
    @Query('year') year?: number,
  ) {
    return this.attendanceService.getAttendanceTrend(tenant, year);
  }
}
