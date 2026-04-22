import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountSettingsService } from './account-settings.service';
import { AccountSettingsController } from './account-settings.controller';
import {
  AccountSettings,
  AccountSettingsSchema,
} from '../../schemas/account-settings.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AccountSettings.name, schema: AccountSettingsSchema },
    ]),
  ],
  controllers: [AccountSettingsController],
  providers: [AccountSettingsService],
  exports: [AccountSettingsService],
})
export class AccountSettingsModule {}
