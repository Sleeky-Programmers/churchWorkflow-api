import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Admin } from './admin.schema';
import { Member } from './member.schema';

export enum PastoralAlertCategory {
  CRITICAL = 'critical',
  ABSENCES = 'absences',
  DECLINE = 'decline',
  FIRST_TIMERS = 'first-timers',
  POSITIVE = 'positive',
  RETURNING = 'returning',
}

export enum PastoralAlertSeverity {
  URGENT = 'urgent',
  HIGH = 'high',
  MEDIUM = 'medium',
  INFO = 'info',
}

export interface PastoralNote {
  body: string;
  authorId: Types.ObjectId;
  authorName: string;
  createdAt: Date;
  updatedAt?: Date | null;
  kind?: 'general' | 'resolve-outcome';
}

/**
 * A pastoral alert on a member for the CW Members module. One document per
 * (member, category). State (resolved / read / notes) survives refreshes.
 */
@Schema({ timestamps: true })
export class PastoralAlert extends Document {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: 'Church',
    required: true,
    index: true,
  })
  churchId: Types.ObjectId;

  @Prop({
    type: SchemaTypes.ObjectId,
    ref: Member.name,
    required: true,
    index: true,
  })
  memberId: Types.ObjectId;

  @Prop({ type: String, enum: PastoralAlertCategory, required: true })
  category: PastoralAlertCategory;

  @Prop({ type: String, enum: PastoralAlertSeverity, required: true })
  severity: PastoralAlertSeverity;

  @Prop({ default: false })
  resolved: boolean;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  resolvedBy: Types.ObjectId | null;

  @Prop({ default: null })
  resolvedAt: Date | null;

  @Prop({ default: false })
  read: boolean;

  @Prop({
    type: [
      {
        body: String,
        authorId: SchemaTypes.ObjectId,
        authorName: String,
        createdAt: Date,
        updatedAt: { type: Date, default: null },
        kind: { type: String, default: 'general' },
      },
    ],
    default: [],
  })
  notes: PastoralNote[];
}

export const PastoralAlertSchema = SchemaFactory.createForClass(PastoralAlert);

PastoralAlertSchema.index(
  { churchId: 1, memberId: 1, category: 1 },
  { unique: true },
);
