import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class OfferingType extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop()
  name: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number;

  // System-seeded offering types (Tithe, Offering, etc.) can be
  // Deactivated/renamed but not deleted, unlike church-created ones.
  @Prop({ default: false })
  isSystem: boolean;

  @Prop({ default: false })
  isDefault: boolean;
}

export const OfferingTypeSchema = SchemaFactory.createForClass(OfferingType);

OfferingTypeSchema.index({ churchId: 1 });
