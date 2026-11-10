import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Admin } from './admin.schema';
import { Church } from './church.schema';

@Schema({ _id: false })
export class TimerTemplateItem {
  @Prop({ required: true }) name: string;
  @Prop({ default: '' }) person: string;
  @Prop({ required: true, min: 0 }) minutes: number;
}
export const TimerTemplateItemSchema =
  SchemaFactory.createForClass(TimerTemplateItem);

/**
 * A saved service flow. Templates are shared by every branch of a church,
 * and loading one copies its items: the live program never edits it.
 */
@Schema({ timestamps: true })
export class TimerTemplate extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  // Lower-cased name, so "Sunday Service" and "sunday service" clash.
  @Prop({ required: true })
  nameKey: string;

  @Prop({ default: '09:00' })
  serviceStart: string;

  @Prop({ type: [TimerTemplateItemSchema], default: [] })
  items: TimerTemplateItem[];

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  updatedBy: Types.ObjectId | null;
}

export const TimerTemplateSchema = SchemaFactory.createForClass(TimerTemplate);

TimerTemplateSchema.index({ churchId: 1, nameKey: 1 }, { unique: true });
