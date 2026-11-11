import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Admin } from './admin.schema';
import { Church } from './church.schema';

export enum UsageStatKind {
  PAGE = 'page',
  ACTION = 'action',
  // "from>to" page-to-page moves, used for next-step suggestions.
  TRANSITION = 'transition',
  // Suggestion dismissals, used to quiet suggestions that keep being ignored.
  SUGGESTION = 'suggestion',
}

/**
 * Rolled-up usage for one admin and one thing they did (a page, an action, a
 * page-to-page move or a suggestion). Raw events are never stored - only
 * counters - so the collection stays small and holds no browsing history.
 */
@Schema({ timestamps: true })
export class UsageStat extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, required: true })
  adminId: Types.ObjectId;

  // Role the admin held when last seen; powers "people in your role" hints.
  @Prop({ type: SchemaTypes.ObjectId, default: null })
  roleId: Types.ObjectId | null;

  @Prop({ type: String, enum: UsageStatKind, required: true })
  kind: UsageStatKind;

  @Prop({ required: true })
  key: string;

  @Prop({ default: 0 })
  count: number;

  @Prop({ default: Date.now })
  lastAt: Date;

  // Visits by hour of day (0-23) and day of week (0 = Sunday), UTC.
  // Stored as objects keyed by hour / day so counters can be incremented in
  // Place with a single upsert.
  @Prop({ type: SchemaTypes.Mixed })
  hourCounts: Record<string, number>;

  @Prop({ type: SchemaTypes.Mixed })
  dayCounts: Record<string, number>;

  // Total time spent on a page, in seconds (pages only).
  @Prop({ default: 0 })
  totalSeconds: number;

  @Prop({ default: 0 })
  dismissedCount: number;

  @Prop({ type: Date, default: null })
  lastDismissedAt: Date | null;
}

export const UsageStatSchema = SchemaFactory.createForClass(UsageStat);

UsageStatSchema.index({ adminId: 1, kind: 1, key: 1 }, { unique: true });
UsageStatSchema.index({ churchId: 1, roleId: 1, kind: 1 });
