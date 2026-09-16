import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Branch extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ default: null })
  alias: string;

  @Prop({ default: null })
  address: string;

  @Prop({ default: null })
  country: string;

  @Prop({ default: null })
  state: string;

  @Prop({ default: null })
  timeZone: string;

  @Prop({ default: false })
  isHQ: boolean;

  @Prop({ default: true })
  isActive: boolean;
}

export const BranchSchema = SchemaFactory.createForClass(Branch);

BranchSchema.index({ churchId: 1 });
