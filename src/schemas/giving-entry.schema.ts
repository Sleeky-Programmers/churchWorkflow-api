import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { GivingBatch } from './giving-batch.schema';
import { OfferingType } from './offering-type.schema';

export enum GivingEntryPaymentMethod {
  CASH = 'Cash',
  BANK_TRANSFER = 'Bank Transfer',
  POS = 'POS',
  USSD = 'USSD',
  CARD = 'Card',
  MOBILE_MONEY = 'Mobile Money',
  CHEQUE = 'Cheque',
  ONLINE = 'Online',
}

@Schema({ timestamps: true })
export class GivingEntry extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: GivingBatch.name })
  batchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: OfferingType.name })
  offeringTypeId: Types.ObjectId;

  @Prop()
  currencyCode: string;

  @Prop({ default: 0 })
  amount: number;

  @Prop({
    enum: GivingEntryPaymentMethod,
    default: GivingEntryPaymentMethod.CASH,
  })
  paymentMethod: GivingEntryPaymentMethod;

  @Prop({ default: null })
  note: string;

  // Giving is not linked to a Member record (only free-text donor fields).
  // Guest rule: guests (VISITOR) must not have giving records. If a memberId
  // Is ever added here, reject VISITORs the way departments and small teams
  // Do (MembersService.assertNoGuests).
  @Prop({ default: null })
  donorName: string;

  @Prop({ default: null })
  donorEmail: string;

  @Prop({ default: null })
  paymentReference: string;
}

export const GivingEntrySchema = SchemaFactory.createForClass(GivingEntry);

GivingEntrySchema.index({ batchId: 1 });
GivingEntrySchema.index({ paymentReference: 1 });
