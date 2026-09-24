import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Currency extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop()
  code: string;

  @Prop()
  symbol: string;

  @Prop()
  name: string;

  @Prop({ default: false })
  isDefault: boolean;

  @Prop({ default: true })
  isActive: boolean;
}

export const CurrencySchema = SchemaFactory.createForClass(Currency);

CurrencySchema.index({ churchId: 1 });
CurrencySchema.index({ churchId: 1, code: 1 }, { unique: true });
