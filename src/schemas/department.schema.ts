import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Admin } from './admin.schema';
import { Member } from './member.schema';
import { DepartmentStatus } from '../common/utils/enums.utils';
import { Branch } from './branch.schema';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Department extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  @Prop()
  name: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  hod: Types.ObjectId | null;

  // Set instead of hod when the department is created/edited with "invite
  // New head" - the invited person isn't an admin yet. Mirrors
  // SmallTeam.pendingLeaderEmail.
  @Prop({ default: null, lowercase: true, trim: true })
  pendingHodEmail: string | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  assistantHod: Types.ObjectId | null;

  @Prop({ default: null, lowercase: true, trim: true })
  pendingAssistantHodEmail: string | null;

  @Prop({ type: [SchemaTypes.ObjectId], ref: Member.name })
  members: Types.ObjectId[];

  @Prop({ default: DepartmentStatus.ACTIVE })
  status: DepartmentStatus;

  @Prop()
  description: string;
}

export const DepartmentSchema = SchemaFactory.createForClass(Department);

DepartmentSchema.index({ churchId: 1, branchId: 1 });
