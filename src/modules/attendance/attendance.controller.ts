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
import { CreateAttendanceDto } from './dto/create-attendance.dto';
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
    @Query('serviceId') serviceId: string,
    @Body() createAttendanceDto: CreateAttendanceDto,
  ) {
    return this.attendanceService.markAttendance(
      authUser,
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
    @Query('serviceId') serviceId: string,
    @Body() createAttendanceDto: CreateAttendanceDto,
  ) {
    return this.attendanceService.markAsAbsent(
      authUser,
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
    @AuthUser() authUser: Admin,
    @Query('serviceId') serviceId: string,
    @Query('date') date: string,
  ) {
    return this.attendanceService.getAttendance(authUser, serviceId, date);
  }

  @Get('member/:memberId')
  async getMemberAttendanceHistory(
    @AuthUser() authUser: Admin,
    @Param('memberId') memberId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.attendanceService.getMemberAttendanceHistory(
      authUser,
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
  async getAttendanceStats(@AuthUser() authUser: Admin) {
    return this.attendanceService.getAttendanceStats(authUser);
  }

  @Get('trend')
  async getAttendanceTrend(@AuthUser() authUser: Admin) {
    return this.attendanceService.getAttendanceTrend(authUser);
  }
}
