import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountDeletionSchedule } from '../../schemas/account-deletion-schedule.schema';
import { AdminService } from '../admin/admin.service';
import { AccountSettingsService } from '../account-settings/account-settings.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ScheduleAccountDeletionDto } from './dto/schedule-account-deletion.dto';
import { AccountDeletionStatus } from '../../common/utils/enums.utils';

@Injectable()
export class AccountDeletionService {
  constructor(
    @InjectModel(AccountDeletionSchedule.name)
    private readonly accountDeletionScheduleModel: Model<AccountDeletionSchedule>,
    private readonly adminService: AdminService,
    private readonly accountSettingsService: AccountSettingsService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  async scheduleDeletion(
    adminId: Types.ObjectId,
    dto: ScheduleAccountDeletionDto,
  ) {
    const existingSchedule = await this.accountDeletionScheduleModel.findOne({
      adminId,
      status: AccountDeletionStatus.PENDING,
    });

    if (existingSchedule) {
      return { message: 'Account deletion is already scheduled' };
    }

    const waitingPeriod = dto.waitingPeriod || 30;
    const executeAt = new Date();
    executeAt.setDate(executeAt.getDate() + waitingPeriod);

    const schedule = await this.accountDeletionScheduleModel.create({
      adminId,
      scheduledAt: new Date(),
      executeAt,
      status: AccountDeletionStatus.PENDING,
    });

    return { message: 'Account deletion successfully scheduled', schedule };
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleAccountDeletions() {
    const now = new Date();

    const pendingDeletions = await this.accountDeletionScheduleModel.find({
      status: AccountDeletionStatus.PENDING,
      executeAt: { $lte: now },
    });

    for (const schedule of pendingDeletions) {
      try {
        const adminId = schedule.adminId;

        await this.activityLogService.deleteByAdminId(adminId);
        await this.accountSettingsService.deleteByAdminId(adminId);

        await this.adminService.findByIdAndDelete(adminId);

        schedule.status = AccountDeletionStatus.COMPLETED;
        await schedule.save();
      } catch (error) {
        schedule.status = AccountDeletionStatus.FAILED;
        await schedule.save();
      }
    }
  }
}
