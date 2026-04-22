import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { DiscountType } from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class Coupon extends Document {
  @Prop()
  code: string;

  @Prop()
  description: string;

  @Prop({ enum: DiscountType })
  discountType: DiscountType;

  @Prop({ required: true })
  discount: number;

  @Prop({ default: 0 })
  maxUsage: number;

  @Prop()
  expiryDate: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  usageCount: number;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
