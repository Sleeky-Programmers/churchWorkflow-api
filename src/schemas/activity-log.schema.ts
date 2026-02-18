import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, Document } from 'mongoose';
import { Church } from './church.schema';
import { ModuleSections } from '../common/utils/enums.utils';
import { Admin } from './admin.schema';

@Schema({ timestamps: true })
export class ActivityLog extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name })
  adminId: Types.ObjectId;

  @Prop()
  action: string;

  @Prop()
  module: ModuleSections;

  @Prop()
  details: string;
}

export const ActivityLogSchema = SchemaFactory.createForClass(ActivityLog);
