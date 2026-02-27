import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, Document } from 'mongoose';
import { Admin } from './admin.schema';
import { AccountDeletionStatus } from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class AccountDeletionSchedule extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, required: true })
  adminId: Types.ObjectId;

  @Prop({ required: true })
  scheduledAt: Date;

  @Prop({ required: true })
  executeAt: Date;

  @Prop({ default: AccountDeletionStatus.PENDING })
  status: AccountDeletionStatus;
}

export const AccountDeletionScheduleSchema = SchemaFactory.createForClass(
  AccountDeletionSchedule,
);
