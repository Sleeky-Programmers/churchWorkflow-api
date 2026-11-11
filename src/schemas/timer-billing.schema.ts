import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Admin } from './admin.schema';
import { Church } from './church.schema';

/** Service Timer plans (Product Plan, section 7). */
export enum TimerPlan {
  FREE = 'FREE',
  CHURCH = 'CHURCH',
}

export enum TimerBillingCycle {
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

export enum TimerPaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
}

/**
 * Prices and limits for one plan, editable by the product team without a
 * deploy. Prices are in naira. 0 means unlimited for limits.
 */
@Schema({ timestamps: true })
export class TimerPlanConfig extends Document {
  @Prop({ type: String, enum: TimerPlan, required: true, unique: true })
  plan: TimerPlan;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 0 })
  monthlyPrice: number;

  @Prop({ default: 0 })
  yearlyPrice: number;

  // Accounts that can use the timer (owner included).
  @Prop({ default: 0 })
  userLimit: number;

  // Successful smart imports a month.
  @Prop({ default: 0 })
  importLimit: number;

  // Branches (each with its own timer). No default on purpose: configs
  // Saved before branch limits existed fall back to the plan's default
  // Instead of reading as 0 (unlimited).
  @Prop({ type: Number })
  branchLimit?: number;

  // Own logo and colours; otherwise colour presets and a "Service Timer" mark.
  @Prop({ default: false })
  customBranding: boolean;

  // Paystack plans that auto-renewing subscriptions charge on, per cycle.
  // `amount` is the naira price the plan was made with; a price change makes
  // A new plan for new subscribers (existing ones keep theirs).
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  paystackPlans: Partial<
    Record<TimerBillingCycle, { code: string; amount: number }>
  >;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  updatedBy: Types.ObjectId | null;
}
export const TimerPlanConfigSchema =
  SchemaFactory.createForClass(TimerPlanConfig);

/** A timer-only church's paid plan. No document, or an expired one, means Free. */
@Schema({ timestamps: true })
export class TimerSubscription extends Document {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: Church.name,
    required: true,
    unique: true,
  })
  churchId: Types.ObjectId;

  @Prop({ type: String, enum: TimerPlan, default: TimerPlan.CHURCH })
  plan: TimerPlan;

  @Prop({ type: String, enum: TimerBillingCycle, required: true })
  cycle: TimerBillingCycle;

  // Paid up to here; paying again extends it.
  @Prop({ type: Date, required: true })
  currentPeriodEnd: Date;

  // Auto-renew through a Paystack subscription. Paystack charges the saved
  // Card at each period end and tells us by webhook.
  @Prop({ type: Boolean, default: false })
  autoRenew: boolean;

  @Prop({ type: String, default: null })
  paystackCustomerCode: string | null;

  @Prop({ type: String, default: null })
  paystackSubscriptionCode: string | null;

  // Needed to cancel the Paystack subscription.
  @Prop({ type: String, default: null })
  paystackEmailToken: string | null;

  @Prop({ type: String, default: null })
  paystackPlanCode: string | null;
}
export const TimerSubscriptionSchema =
  SchemaFactory.createForClass(TimerSubscription);

/** One Paystack payment for the timer. Applied to the subscription exactly once. */
@Schema({ timestamps: true })
export class TimerPayment extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  // Who paid; null for automatic renewals.
  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  adminId: Types.ObjectId | null;

  // Set up auto-renew once this payment succeeds.
  @Prop({ type: Boolean, default: false })
  autoRenew: boolean;

  // Charged by a Paystack subscription rather than at checkout.
  @Prop({ type: Boolean, default: false })
  renewal: boolean;

  @Prop({ required: true, unique: true })
  reference: string;

  // Naira.
  @Prop({ required: true })
  amount: number;

  @Prop({ type: String, enum: TimerBillingCycle, required: true })
  cycle: TimerBillingCycle;

  @Prop({
    type: String,
    enum: TimerPaymentStatus,
    default: TimerPaymentStatus.PENDING,
  })
  status: TimerPaymentStatus;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;
}
export const TimerPaymentSchema = SchemaFactory.createForClass(TimerPayment);

TimerPaymentSchema.index({ churchId: 1, status: 1 });
TimerSubscriptionSchema.index(
  { paystackSubscriptionCode: 1 },
  { sparse: true },
);
TimerSubscriptionSchema.index({ paystackCustomerCode: 1 }, { sparse: true });
