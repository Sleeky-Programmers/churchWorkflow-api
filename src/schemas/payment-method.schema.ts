import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Church } from './church.schema';
import { GivingEntryPaymentMethod } from './giving-entry.schema';

@Schema({ timestamps: true })
export class PaymentMethod extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  // One of the fixed GivingEntryPaymentMethod preset codes - churches pick
  // Which presets apply to them rather than defining their own.
  @Prop({ enum: GivingEntryPaymentMethod })
  code: GivingEntryPaymentMethod;

  @Prop()
  name: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number;
}

export const PaymentMethodSchema = SchemaFactory.createForClass(PaymentMethod);

PaymentMethodSchema.index({ churchId: 1 });
PaymentMethodSchema.index({ churchId: 1, code: 1 }, { unique: true });
