import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Title extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop()
  name: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: 0 })
  sortOrder: number;

  // System-seeded titles (from the shared title catalog) can be
  // Deactivated/renamed but not deleted, unlike church-created ones.
  @Prop({ default: false })
  isSystem: boolean;
}

export const TitleSchema = SchemaFactory.createForClass(Title);

TitleSchema.index({ churchId: 1 });
