import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Admin } from './admin.schema';
import { Church } from './church.schema';

export enum TimerImportSource {
  PDF = 'pdf',
  WORD = 'word',
  IMAGE = 'image',
  TEXT = 'text',
}

export enum TimerImportStatus {
  SUCCEEDED = 'succeeded',
  // The model couldn't find a program, or declined: not counted against the plan.
  UNREADABLE = 'unreadable',
  FAILED = 'failed',
}

/**
 * One smart import (Product Plan, section 4). Only successful imports count
 * against the church's monthly allowance; the token counts show what each
 * import actually cost.
 */
@Schema({ timestamps: true })
export class TimerImport extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, required: true })
  adminId: Types.ObjectId;

  @Prop({ type: String, enum: TimerImportSource, required: true })
  source: TimerImportSource;

  @Prop({ type: String, default: null })
  fileName: string | null;

  @Prop({ type: String, enum: TimerImportStatus, required: true })
  status: TimerImportStatus;

  @Prop({ default: 0 })
  itemCount: number;

  @Prop({ type: String, default: null })
  aiModel: string | null;

  @Prop({ default: 0 })
  inputTokens: number;

  @Prop({ default: 0 })
  outputTokens: number;

  @Prop({ type: String, default: null })
  error: string | null;
}

export const TimerImportSchema = SchemaFactory.createForClass(TimerImport);

TimerImportSchema.index({ churchId: 1, status: 1, createdAt: -1 });
