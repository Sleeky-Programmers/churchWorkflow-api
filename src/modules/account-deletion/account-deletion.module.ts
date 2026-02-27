import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountDeletionService } from './account-deletion.service';
import { AccountDeletionController } from './account-deletion.controller';
import {
  AccountDeletionSchedule,
  AccountDeletionScheduleSchema,
} from '../../schemas/account-deletion-schedule.schema';
import { AdminModule } from '../admin/admin.module';
import { AccountSettingsModule } from '../account-settings/account-settings.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: AccountDeletionSchedule.name,
        schema: AccountDeletionScheduleSchema,
      },
    ]),
    AdminModule,
    AccountSettingsModule,
    ActivityLogModule,
  ],
  controllers: [AccountDeletionController],
  providers: [AccountDeletionService],
  exports: [AccountDeletionService],
})
export class AccountDeletionModule {}
