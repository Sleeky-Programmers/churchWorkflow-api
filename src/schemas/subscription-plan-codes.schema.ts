import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SubscriptionPlanCodes extends Document {
  @Prop()
  billingCycle: string;

  @Prop()
  planCode: string;
}

export const SubscriptionPlanCodesSchema = SchemaFactory.createForClass(
  SubscriptionPlanCodes,
);
