import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Admin } from './admin.schema';
import { Branch } from './branch.schema';
import { Church } from './church.schema';
import { Department } from './department.schema';

@Schema({ timestamps: true })
export class Expense extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  // Free text on purpose - not a managed list, keeps this module lightweight.
  @Prop()
  category: string;

  @Prop()
  description: string;

  @Prop({ default: 0 })
  amount: number;

  @Prop()
  currency: string;

  @Prop()
  date: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name })
  recordedBy: Types.ObjectId;

  // Set once Requisitions (Phase 3/4) auto-converts an approved requisition
  // Into an expense. Ref name is forward-declared - the Requisition schema
  // Doesn't exist yet, this field just stays null until it does.
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Requisition', default: null })
  requisitionId: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: Department.name, default: null })
  departmentId: Types.ObjectId | null;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);

ExpenseSchema.index({ churchId: 1, branchId: 1 });
ExpenseSchema.index({ churchId: 1, date: -1 });
