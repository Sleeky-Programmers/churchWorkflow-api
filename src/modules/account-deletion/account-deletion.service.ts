import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountDeletionSchedule } from '../../schemas/account-deletion-schedule.schema';
import { Admin } from '../../schemas/admin.schema';
import { AccountSettings } from '../../schemas/account-settings.schema';
import { ActivityLog } from '../../schemas/activity-log.schema';
import { ScheduleAccountDeletionDto } from './dto/schedule-account-deletion.dto';
import { AccountDeletionStatus } from '../../common/utils/enums.utils';

@Injectable()
export class AccountDeletionService {
  constructor(
    @InjectModel(AccountDeletionSchedule.name)
    private readonly accountDeletionScheduleModel: Model<AccountDeletionSchedule>,
    @InjectModel(Admin.name) private readonly adminModel: Model<Admin>,
    @InjectModel(AccountSettings.name)
    private readonly accountSettingsModel: Model<AccountSettings>,
    @InjectModel(ActivityLog.name)
    private readonly activityLogModel: Model<ActivityLog>,
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

    const executeAt = dto.executeAt ? new Date(dto.executeAt) : new Date();
    if (!dto.executeAt) {
      executeAt.setDate(executeAt.getDate() + 30);
    }

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

        await this.activityLogModel.deleteMany({ adminId });
        await this.accountSettingsModel.deleteMany({ adminId });

        await this.adminModel.findByIdAndDelete(adminId);

        schedule.status = AccountDeletionStatus.COMPLETED;
        await schedule.save();
      } catch (error) {
        schedule.status = AccountDeletionStatus.FAILED;
        await schedule.save();
      }
    }
  }
}
