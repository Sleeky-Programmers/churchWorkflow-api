import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountSettings } from '../../schemas/account-settings.schema';
import { AccountSettingsDto } from './dto/account-settings.dto';

@Injectable()
export class AccountSettingsService {
  constructor(
    @InjectModel(AccountSettings.name)
    private accountSettingsModel: Model<AccountSettings>,
  ) {}

  async getAccountSettings(adminId: Types.ObjectId) {
    return await this.accountSettingsModel.findOne({ adminId });
  }

  async createDefaultAccountSettings(adminId: Types.ObjectId) {
    return await this.accountSettingsModel.create({
      adminId,
    });
  }

  async updateAccountSettings(
    adminId: Types.ObjectId,
    settings: Partial<AccountSettingsDto>,
  ) {
    return await this.accountSettingsModel.findOneAndUpdate(
      { adminId },
      settings,
      { new: true },
    );
  }

  async deleteByAdminId(adminId: Types.ObjectId) {
    return await this.accountSettingsModel.deleteMany({ adminId });
  }
}
