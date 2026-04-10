import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BillingCycle, PaymentStatus } from '../common/utils/enums.utils';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Payment extends Document {
  @Prop({ type: Types.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  @Prop({ type: String, required: true })
  reference: string;

  @Prop({ type: Number, required: true })
  amount: number;

  @Prop({ type: String, default: 'NGN' })
  currency: string;

  @Prop({
    type: String,
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Prop({ type: String })
  plan: string;

  @Prop({ type: String, enum: BillingCycle })
  billingCycle: BillingCycle;

  @Prop({ type: String })
  paymentMethod: string;

  @Prop({ type: String })
  transactionId: string;

  @Prop({ type: Boolean, default: false })
  autoRenew: boolean;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop({ type: String })
  paymentGateway: string;

  @Prop({ type: Date })
  paidAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
