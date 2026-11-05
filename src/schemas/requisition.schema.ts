import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Admin } from './admin.schema';
import { Branch } from './branch.schema';
import { Church } from './church.schema';
import { Department } from './department.schema';
import { Expense } from './expense.schema';
import { RequisitionStatus } from '../common/utils/enums.utils';

// A reviewer or the requester asking for / giving clarification without
// Changing the requisition's status.
@Schema({ _id: true, timestamps: { createdAt: true, updatedAt: false } })
export class RequisitionComment {
  _id: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: 'Admin', required: true })
  authorId: Types.ObjectId;

  @Prop({ required: true })
  authorName: string;

  @Prop({ required: true })
  body: string;

  createdAt: Date;
}

export const RequisitionCommentSchema =
  SchemaFactory.createForClass(RequisitionComment);

@Schema({ timestamps: true })
export class Requisition extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: Department.name })
  departmentId: Types.ObjectId;

  @Prop()
  title: string;

  @Prop()
  description: string;

  @Prop({ default: 0 })
  amount: number;

  @Prop()
  currency: string;

  @Prop({ default: RequisitionStatus.PENDING })
  status: RequisitionStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name })
  requestedBy: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  reviewedBy: Types.ObjectId | null;

  @Prop({ default: null })
  reviewedAt: Date | null;

  @Prop({ default: null })
  reviewNote: string | null;

  // Set once approved and auto-converted into an Expense.
  @Prop({ type: SchemaTypes.ObjectId, ref: Expense.name, default: null })
  expenseId: Types.ObjectId | null;

  @Prop({ type: [RequisitionCommentSchema], default: [] })
  comments: RequisitionComment[];
}

export const RequisitionSchema = SchemaFactory.createForClass(Requisition);

RequisitionSchema.index({ churchId: 1, branchId: 1 });
RequisitionSchema.index({ departmentId: 1, status: 1 });
