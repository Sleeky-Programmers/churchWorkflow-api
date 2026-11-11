import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Admin } from './admin.schema';
import { Church } from './church.schema';

export enum ReportDigestFrequency {
  NONE = 'none',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  BOTH = 'both',
}

/**
 * Which report sections a church (adminId = null, the shared default) or an
 * individual admin has switched off. Stored as an opt-out list so sections
 * added later appear automatically.
 */
@Schema({ timestamps: true })
export class ReportProfile extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  // Null = the church-wide default profile.
  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  adminId: Types.ObjectId | null;

  @Prop({ type: [String], default: [] })
  excludedSections: string[];

  // Personal profiles only: when false the person follows the church default
  // And excludedSections is ignored.
  @Prop({ default: false })
  overridesChurchDefault: boolean;

  // Only meaningful on personal profiles.
  @Prop({
    type: String,
    enum: ReportDigestFrequency,
    default: ReportDigestFrequency.NONE,
  })
  digestFrequency: ReportDigestFrequency;
}

export const ReportProfileSchema = SchemaFactory.createForClass(ReportProfile);

ReportProfileSchema.index({ churchId: 1, adminId: 1 }, { unique: true });
