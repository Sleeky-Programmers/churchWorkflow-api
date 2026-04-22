import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { BillingCycle, PaymentStatus } from '../common/utils/enums.utils';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Payment extends Document {
  @Prop({ type: Types.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop()
  reference: string;

  @Prop()
  amount: number;

  @Prop({ default: 'NGN' })
  currency: string;

  @Prop({
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Prop()
  plan: string;

  @Prop({ enum: BillingCycle })
  billingCycle: BillingCycle;

  @Prop({ default: null })
  paymentMethod: string;

  @Prop()
  transactionId: string;

  @Prop({ default: false })
  autoRenew: boolean;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop()
  paymentGateway: string;

  @Prop()
  paidAt: Date;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
