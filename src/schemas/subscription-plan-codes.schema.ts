import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

import { PlanType } from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class SubscriptionPlanCodes extends Document {
  @Prop({ type: String, enum: PlanType, required: true })
  plan: PlanType;

  @Prop()
  billingCycle: string;

  @Prop()
  planCode: string;
}

export const SubscriptionPlanCodesSchema = SchemaFactory.createForClass(
  SubscriptionPlanCodes,
);

SubscriptionPlanCodesSchema.index(
  { plan: 1, billingCycle: 1 },
  { unique: true },
);
