import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

import { PlanType } from '../common/utils/enums.utils';
import { ProductAdmin } from './product-admin.schema';

@Schema({ timestamps: true })
export class PlanPricing extends Document {
  @Prop({
    type: String,
    enum: PlanType,
    unique: true,
    required: true,
  })
  plan: PlanType;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, default: 0 })
  monthlyPrice: number;

  @Prop({ required: true, default: 0 })
  yearlyPrice: number;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ default: 0 })
  memberLimit: number;

  @Prop({ default: 0 })
  userLimit: number;

  @Prop({ default: 0 })
  branchLimit: number;

  @Prop({ default: false })
  customRolesEnabled: boolean;

  @Prop({ default: false })
  popular: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: ProductAdmin.name, default: null })
  updatedBy: Types.ObjectId | null;
}

export const PlanPricingSchema = SchemaFactory.createForClass(PlanPricing);
