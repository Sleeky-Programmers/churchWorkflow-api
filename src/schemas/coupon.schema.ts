import { Document, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import {
  CouponStatus,
  CouponType,
  DiscountType,
  PlanType,
} from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class Coupon extends Document {
  // Core Fields
  @Prop({ required: true, unique: true, uppercase: true })
  code: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true, enum: CouponType })
  type: CouponType;

  // Discount Configuration
  @Prop({ required: true, enum: DiscountType })
  discountType: DiscountType; // PERCENTAGE or FIXED

  @Prop({ required: true, min: 0 })
  discount: number;

  // Date Management
  @Prop({ required: true })
  validFrom: Date;

  @Prop({ required: true })
  expiryDate: Date;

  // Usage Management
  @Prop({ default: 0 })
  maxUsage: number;

  @Prop({ default: 0 })
  usageCount: number;

  // Status Management
  @Prop({
    enum: CouponStatus,
    default: CouponStatus.DRAFT,
  })
  status: CouponStatus;

  @Prop({ default: true })
  isActive: boolean;

  // Restrictions
  @Prop({
    enum: PlanType,
    required: false,
  })
  minPlanTier?: PlanType;

  @Prop({ type: [String], enum: PlanType, default: [] })
  excludedPlans?: PlanType[];

  @Prop({ default: false })
  isStackable: boolean;

  @Prop({ default: false })
  isTransferable: boolean;

  // Audit Trail
  @Prop({ type: Types.ObjectId, ref: 'ProductAdmin' })
  createdBy: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'ProductAdmin' })
  updatedBy: Types.ObjectId;

  // Usage History
  @Prop({
    type: [
      {
        churchId: { type: Types.ObjectId, ref: 'Church' },
        subscriptionId: { type: Types.ObjectId, ref: 'Subscription' },
        appliedAt: { type: Date, default: Date.now },
        discountApplied: Number,
        planType: { type: String, enum: PlanType },
        originalAmount: Number,
        discountedAmount: Number,
      },
    ],
    default: [],
  })
  usageHistory: Array<{
    churchId: Types.ObjectId;
    subscriptionId: Types.ObjectId;
    appliedAt: Date;
    discountApplied: number;
    planType: PlanType;
    originalAmount: number;
    discountedAmount: number;
  }>;

  // Soft Delete
  @Prop()
  deletedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'ProductAdmin' })
  deletedBy?: Types.ObjectId;

  // Additional Metadata
  @Prop({ type: Map, of: String })
  metadata: Map<string, any>;

  @Prop({ default: false })
  isSystemGenerated: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const CouponSchema = SchemaFactory.createForClass(Coupon);

// Add indexes for performance
CouponSchema.index({ code: 1 }, { unique: true });
CouponSchema.index({ status: 1, isActive: 1 });
CouponSchema.index({ validFrom: 1, expiryDate: 1 });
CouponSchema.index({ type: 1 });
CouponSchema.index({ 'usageHistory.churchId': 1 });
CouponSchema.index({ createdAt: -1 });

// Add virtual fields
CouponSchema.virtual('remainingUses').get(function () {
  if (this.maxUsage === 0) {
    return Infinity;
  }
  return Math.max(0, this.maxUsage - this.usageCount);
});

CouponSchema.virtual('isExpired').get(function () {
  return this.expiryDate < new Date();
});

CouponSchema.virtual('isExpiringSoon').get(function () {
  const now = new Date();
  const sevenDaysFromNow = new Date();
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  return this.expiryDate > now && this.expiryDate <= sevenDaysFromNow;
});

CouponSchema.virtual('usagePercentage').get(function () {
  if (this.maxUsage === 0) {
    return 0;
  }
  return (this.usageCount / this.maxUsage) * 100;
});

// Pre-save middleware to auto-update status
CouponSchema.pre('save', function (next) {
  const now = new Date();

  // Auto-update status based on dates and usage
  if (this.deletedAt) {
    this.status = CouponStatus.DISABLED;
  } else if (this.maxUsage > 0 && this.usageCount >= this.maxUsage) {
    this.status = CouponStatus.FULLY_USED;
  } else if (this.expiryDate < now) {
    this.status = CouponStatus.EXPIRED;
  } else if (this.validFrom > now) {
    this.status = CouponStatus.PUBLISHED; // Not yet active
  } else if (
    this.status === CouponStatus.PUBLISHED ||
    this.status === CouponStatus.DRAFT
  ) {
    this.status = CouponStatus.ACTIVE;
  }

  next();
});
