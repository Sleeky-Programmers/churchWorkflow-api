import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionController } from './account-deletion.controller';
import {
  AccountDeletionSchedule,
  AccountDeletionScheduleSchema,
} from '../../schemas/account-deletion-schedule.schema';
import { Admin, AdminSchema } from '../../schemas/admin.schema';
import {
  AccountSettings,
  AccountSettingsSchema,
} from '../../schemas/account-settings.schema';
import {
  ActivityLog,
  ActivityLogSchema,
} from '../../schemas/activity-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AccountDeletionSchedule.name,
        schema: AccountDeletionScheduleSchema,
      },
      { name: Admin.name, schema: AdminSchema },
      { name: AccountSettings.name, schema: AccountSettingsSchema },
      { name: ActivityLog.name, schema: ActivityLogSchema },
    ]),
  ],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService],
})
export class AccountDeletionModule {}
