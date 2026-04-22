import { Controller, Post, Get, Delete, Body, UseGuards } from '@nestjs/common';
import { AccountDeletionService } from './account-deletion.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { ScheduleAccountDeletionDto } from './dto/schedule-account-deletion.dto';

@UseGuards(JwtAuthGuard)
@Controller('account-deletion')
export class AccountDeletionController {
  constructor(
    private readonly accountDeletionService: AccountDeletionService,
  ) {}

  @Post('schedule')
  async scheduleDeletion(
    @AuthUser() authUser: Admin,
    @Body() scheduleDto: ScheduleAccountDeletionDto,
  ) {
    return this.accountDeletionService.scheduleDeletion(
      authUser._id,
      scheduleDto,
    );
  }

  @Get('schedule')
  async getDeletionSchedule(@AuthUser() authUser: Admin) {
    return this.accountDeletionService.getDeletionSchedule(authUser._id);
  }

  @Delete('unschedule')
  async unscheduleDeletion(@AuthUser() authUser: Admin) {
    return this.accountDeletionService.unscheduleDeletion(authUser._id);
  }
}
