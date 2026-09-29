import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Church } from './church.schema';

/**
 * Per-church configuration for the CW Members pastoral module. Drives the
 * attention classification shown on the dashboard and attention center.
 */
@Schema({ timestamps: true })
export class MemberPastoralSettings extends Document {
  @Prop({
    type: SchemaTypes.ObjectId,
    ref: Church.name,
    required: true,
    unique: true,
    index: true,
  })
  churchId: Types.ObjectId;

  // Absence thresholds (consecutive absences)
  @Prop({ default: 2 })
  needsFollowUpThreshold: number;

  @Prop({ default: 4 })
  atRiskThreshold: number;

  @Prop({ default: 8 })
  inactiveThreshold: number;

  // Service tracking
  @Prop({
    type: String,
    enum: ['SUNDAYS_ONLY', 'SUNDAYS_MIDWEEK', 'ALL_SERVICES'],
    default: 'SUNDAYS_ONLY',
  })
  trackingMode: string;

  @Prop({ default: false })
  countSpecialEvents: boolean;

  @Prop({ default: false })
  countSmallTeams: boolean;
}

export const MemberPastoralSettingsSchema =
  SchemaFactory.createForClass(MemberPastoralSettings);
