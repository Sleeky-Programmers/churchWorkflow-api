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

@UseGuards(JwtAuthGuard)
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('mark')
  markAttendance(
    @AuthUser() authUser: Admin,
    @Query('serviceId') serviceId: string,
    @Body() createAttendanceDto: CreateAttendanceDto,
  ) {
    return this.attendanceService.markAttendance(
      authUser._id,
      serviceId,
      createAttendanceDto,
    );
  }

  @Get()
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
  async getAttendanceStats(@AuthUser() authUser: Admin) {
    return this.attendanceService.getAttendanceStats(authUser);
  }
}
