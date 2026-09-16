import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Admin } from './admin.schema';
import { Branch } from './branch.schema';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class AdminBranchAccess extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, required: true })
  adminId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, required: true })
  branchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;
}

export const AdminBranchAccessSchema =
  SchemaFactory.createForClass(AdminBranchAccess);

AdminBranchAccessSchema.index({ adminId: 1, branchId: 1 }, { unique: true });
AdminBranchAccessSchema.index({ adminId: 1 });
AdminBranchAccessSchema.index({ branchId: 1 });
