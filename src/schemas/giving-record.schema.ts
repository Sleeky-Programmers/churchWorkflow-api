import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Admin } from './admin.schema';
import { Branch } from './branch.schema';
import { Church } from './church.schema';
import { ChurchService } from './church-service.schema';

@Schema({ timestamps: true })
export class GivingRecord extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  // Matches Attendance.churchServiceId - the recurring service definition,
  // Not a per-occurrence instance. Paired with `date` to identify the
  // Specific occurrence, exactly like attendance marking does.
  @Prop({ type: SchemaTypes.ObjectId, ref: ChurchService.name })
  churchServiceId: Types.ObjectId;

  // 'YYYY-MM-DD', matches Attendance.date convention.
  @Prop()
  date: string;

  @Prop({ default: 0 })
  tithe: number;

  @Prop({ default: 0 })
  offering: number;

  @Prop({ default: 0 })
  specialOffering: number;

  @Prop({ default: 0 })
  thanksgivingOffering: number;

  @Prop({ default: 0 })
  totalAmount: number;

  @Prop()
  currency: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name })
  recordedBy: Types.ObjectId;
}

export const GivingRecordSchema = SchemaFactory.createForClass(GivingRecord);

GivingRecordSchema.index({ churchId: 1, branchId: 1 });
// One giving record per service occurrence - a second save for the same
// (churchServiceId, date) updates in place rather than duplicating.
GivingRecordSchema.index({ churchServiceId: 1, date: 1 }, { unique: true });
