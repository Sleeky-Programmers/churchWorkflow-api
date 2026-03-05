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
    let settings = await this.accountSettingsModel.findOne({ adminId });
    
    if (!settings) {
      settings = await this.createDefaultAccountSettings(adminId);
    }
    
    return settings;
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
    const updatePayload: any = { $set: {} };

    if (settings.personalPreferences) {
      for (const [key, value] of Object.entries(settings.personalPreferences)) {
        updatePayload.$set[`personalPreferences.${key}`] = value;
      }
    }
    
    if (settings.personalPrivacy) {
      for (const [key, value] of Object.entries(settings.personalPrivacy)) {
        updatePayload.$set[`personalPrivacy.${key}`] = value;
      }
    }

    return await this.accountSettingsModel.findOneAndUpdate(
      { adminId },
      Object.keys(updatePayload.$set).length > 0 ? updatePayload : { $set: { updatedAt: new Date() } },
      { new: true, upsert: true }, 
    );
  }

  async deleteByAdminId(adminId: Types.ObjectId) {
    return await this.accountSettingsModel.deleteMany({ adminId });
  }
}
