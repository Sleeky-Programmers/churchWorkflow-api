import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Branch } from './branch.schema';
import { Church } from './church.schema';

/**
 * How long one program item actually ran, for service reports. Recorded by
 * the device that moved the timer on (laptop or phone), queued while
 * offline, and updated in place: a pause sends a snapshot, moving to the
 * next item sends the final one.
 */
@Schema({ timestamps: true })
export class TimerItemRun extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, required: true })
  branchId: Types.ObjectId;

  // From the device: item id + when it first started, so snapshots of the
  // Same run update one record.
  @Prop({ required: true })
  runId: string;

  @Prop({ required: true })
  itemName: string;

  @Prop({ default: '' })
  person: string;

  @Prop({ default: 0 })
  plannedMinutes: number;

  // Minutes added or removed during the run (+1 / −1), in ms.
  @Prop({ default: 0 })
  extraMs: number;

  @Prop({ default: 0 })
  actualMs: number;

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date, required: true })
  endedAt: Date;

  // The service's date in the church's time zone, "YYYY-MM-DD".
  @Prop({ required: true })
  serviceDate: string;
}

export const TimerItemRunSchema = SchemaFactory.createForClass(TimerItemRun);

TimerItemRunSchema.index({ churchId: 1, runId: 1 }, { unique: true });
TimerItemRunSchema.index({ churchId: 1, branchId: 1, serviceDate: -1 });
