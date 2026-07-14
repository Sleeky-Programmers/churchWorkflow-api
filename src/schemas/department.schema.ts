import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Admin } from './admin.schema';
import { Member } from './member.schema';
import { DepartmentStatus } from '../common/utils/enums.utils';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Department extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop()
  name: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name })
  hod: Types.ObjectId;

  @Prop({ type: [SchemaTypes.ObjectId], ref: Member.name })
  members: Types.ObjectId[];

  @Prop({ default: DepartmentStatus.ACTIVE })
  status: DepartmentStatus;

  @Prop()
  description: string;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);
