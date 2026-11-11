import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Branch } from './branch.schema';
import { Church } from './church.schema';

export enum ReportPeriod {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

/**
 * A frozen picture of every report section for one closed week or month, for
 * one branch (or the whole church when branchId is null). Freezing keeps past
 * reports steady when old records are edited or voided later.
 */
@Schema({ timestamps: true })
export class ReportSnapshot extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  @Prop({ type: String, enum: ReportPeriod, required: true })
  period: ReportPeriod;

  // 'YYYY-MM-DD' (inclusive), UTC.
  @Prop({ required: true })
  periodStart: string;

  @Prop({ required: true })
  periodEnd: string;

  // Section key -> computed section data.
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  sections: Record<string, unknown>;

  @Prop({ default: Date.now })
  generatedAt: Date;
}

export const ReportSnapshotSchema =
  SchemaFactory.createForClass(ReportSnapshot);

ReportSnapshotSchema.index(
  { churchId: 1, branchId: 1, period: 1, periodStart: 1 },
  { unique: true },
);
