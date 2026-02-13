import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, Document } from 'mongoose';
import { Admin } from './admin.schema';

@Schema({ timestamps: true })
export class AccountSettings extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name })
  adminId: Types.ObjectId;

  @Prop({
    type: {
      birthday: { type: Boolean, default: true },
      event: { type: Boolean, default: true },
      requisitionApproval: { type: Boolean, default: true },
    },
    default: {},
  })
  personalPreferences: {
    birthday: boolean;
    event: boolean;
    requisitionApproval: boolean;
  };

  @Prop({
    type: {
      birthdayCalendarDisplay: { type: Boolean, default: true },
      birthdayShoutOut: { type: Boolean, default: true },
      emailAlerts: { type: Boolean, default: true },
    },
    default: {},
  })
  personalPrivacy: {
    birthdayCalendarDisplay: boolean;
    birthdayShoutOut: boolean;
    emailAlerts: boolean;
  };
}

export const AccountSettingsSchema =
  SchemaFactory.createForClass(AccountSettings);
