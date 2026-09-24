import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Admin } from './admin.schema';
import { Branch } from './branch.schema';
import { Church } from './church.schema';
import { ChurchService } from './church-service.schema';

export enum GivingBatchStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  CONFIRMED = 'confirmed',
}

export enum GivingBatchSource {
  MANUAL = 'manual',
  ONLINE = 'online',
}

@Schema({ timestamps: true })
export class GivingBatch extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  // Matches Attendance.churchServiceId - the recurring service definition,
  // Not a per-occurrence instance. Paired with `date` to identify the
  // Specific occurrence, exactly like attendance marking does. Null for
  // Online-giving batches, which aren't tied to a service occurrence.
  @Prop({ type: SchemaTypes.ObjectId, ref: ChurchService.name, default: null })
  churchServiceId: Types.ObjectId | null;

  // 'YYYY-MM-DD', matches Attendance.date convention.
  @Prop()
  date: string;

  @Prop({ enum: GivingBatchStatus, default: GivingBatchStatus.DRAFT })
  status: GivingBatchStatus;

  @Prop({ default: null })
  countedWith: string;

  @Prop({ default: null })
  notes: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  confirmedBy: Types.ObjectId | null;

  @Prop({ default: null })
  confirmedAt: Date;

  @Prop({ default: false })
  isVoided: boolean;

  @Prop({ default: null })
  voidReason: string;

  @Prop({ default: null })
  editReason: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  recordedBy: Types.ObjectId | null;

  // Denormalized sum of this batch's entries - kept in sync on every
  // Create/update so list/summary views don't need to join entries.
  @Prop({ default: 0 })
  totalAmount: number;

  @Prop({ enum: GivingBatchSource, default: GivingBatchSource.MANUAL })
  source: GivingBatchSource;
}

export const GivingBatchSchema = SchemaFactory.createForClass(GivingBatch);

GivingBatchSchema.index({ churchId: 1, branchId: 1 });
// One batch per service occurrence - a second save for the same
// (churchServiceId, date) updates in place rather than duplicating.
GivingBatchSchema.index(
  { churchServiceId: 1, date: 1 },
  {
    unique: true,
    partialFilterExpression: { churchServiceId: { $type: 'objectId' } },
  },
);
