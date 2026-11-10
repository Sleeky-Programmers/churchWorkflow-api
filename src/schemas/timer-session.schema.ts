import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Admin } from './admin.schema';
import { Branch } from './branch.schema';
import { Church } from './church.schema';

// `id: false` lets `id` be a real field (the client's item id) instead of
// Mongoose's virtual.
@Schema({ _id: false, id: false })
export class TimerSessionItem {
  @Prop({ required: true }) id: string;
  @Prop({ default: '' }) name: string;
  @Prop({ default: '' }) person: string;
  @Prop({ default: 0, min: 0 }) minutes: number;
}
export const TimerSessionItemSchema =
  SchemaFactory.createForClass(TimerSessionItem);

/**
 * Stores a start moment, never a ticking number, so every screen computes
 * the same time and nothing drifts (Developer Handoff, section 4).
 */
@Schema({ _id: false })
export class TimerRun {
  @Prop({ default: false }) running: boolean;
  @Prop({ type: Number, default: null }) startedAt: number | null;
  @Prop({ default: 0 }) elapsedBefore: number;
  // +1 / −1 adjustments for this run only.
  @Prop({ default: 0 }) extraMs: number;
}
export const TimerRunSchema = SchemaFactory.createForClass(TimerRun);

@Schema({ _id: false })
export class TimerMessage {
  @Prop({ default: '' }) text: string;
  @Prop({ default: false }) shown: boolean;
}
export const TimerMessageSchema = SchemaFactory.createForClass(TimerMessage);

/**
 * The live timer for one branch: the program, the current item, the clock
 * and the note to the speaker. Every controller and display in the branch
 * draws from this one document.
 */
@Schema({ timestamps: true })
export class TimerSession extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, required: true })
  branchId: Types.ObjectId;

  @Prop({ type: [TimerSessionItemSchema], default: [] })
  items: TimerSessionItem[];

  @Prop({ default: 0 })
  index: number;

  @Prop({ type: TimerRunSchema, default: () => ({}) })
  timer: TimerRun;

  @Prop({ type: TimerMessageSchema, default: () => ({}) })
  message: TimerMessage;

  // Lives on the session, not the settings, because loading a template
  // Changes it: one push then carries the whole change, even offline.
  @Prop({ default: '09:00' })
  serviceStart: string;

  // Increases on every accepted change.
  @Prop({ default: 0 })
  version: number;

  // Client id of the last writer, so a device can ignore its own echo.
  @Prop({ type: String, default: null })
  origin: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  updatedBy: Types.ObjectId | null;
}

export const TimerSessionSchema = SchemaFactory.createForClass(TimerSession);

TimerSessionSchema.index({ churchId: 1, branchId: 1 }, { unique: true });
