import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, Document } from 'mongoose';
import { Church } from './church.schema';
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

  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop()
  createdAt?: Date;

  @Prop()
  updatedAt?: Date;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);
