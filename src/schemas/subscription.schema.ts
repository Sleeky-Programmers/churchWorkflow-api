import { Document, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { PlanType, SubscriptionStatus } from '../common/utils/enums.utils';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Subscription extends Document {
  @Prop({
    type: Types.ObjectId,
    ref: Church.name,
    unique: true,
  })
  churchId: Types.ObjectId;

  @Prop({
    type: String,
    enum: PlanType,
    default: PlanType.STARTER,
  })
  plan: PlanType;

  @Prop({
    type: String,
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  status: SubscriptionStatus;

  @Prop({ default: Date.now })
  startDate: Date;

  @Prop({ default: null })
  endDate: Date;

  @Prop({ default: 0 })
  memberLimit: number;

  @Prop({ default: 0 })
  userLimit: number;

  @Prop({ default: 0 })
  branchLimit: number;

  @Prop({ default: false })
  customRolesEnabled: boolean;

  @Prop({ default: null })
  gracePeriodEndDate: Date;

  @Prop({ default: false })
  isAutoRenew: boolean;

  @Prop({ type: Object })
  provider: Record<string, any>;

  @Prop({ default: null })
  pausedAt: Date | null;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);
