import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

import { Admin } from './admin.schema';
import { Branch } from './branch.schema';
import { Church } from './church.schema';
import { Department } from './department.schema';
import {
  AssetCondition,
  AssetRisk,
  AssetStatus,
} from '../common/utils/enums.utils';

@Schema({ _id: false })
export class AssetConditionBreakdown {
  @Prop({ default: 0 })
  good: number;

  @Prop({ default: 0 })
  fair: number;

  @Prop({ default: 0 })
  repair: number;

  @Prop({ default: 0 })
  damaged: number;
}
export const AssetConditionBreakdownSchema = SchemaFactory.createForClass(
  AssetConditionBreakdown,
);

@Schema({ _id: false })
export class AssetMaintenanceSchedule {
  @Prop({ default: null })
  frequency: string | null;

  @Prop({ default: null })
  lastService: Date | null;

  @Prop({ default: null })
  lastReview: Date | null;

  @Prop({ default: null })
  nextDue: Date | null;

  @Prop({ default: true })
  notificationsEnabled: boolean;

  @Prop({ default: true })
  notifyUpcoming: boolean;

  @Prop({ default: false })
  notifyDue: boolean;

  @Prop({ default: false })
  notifyOverdue: boolean;

  @Prop({ default: 7 })
  notifyDaysBefore: number;

  @Prop({ type: [String], default: [] })
  recipients: string[];
}
export const AssetMaintenanceScheduleSchema = SchemaFactory.createForClass(
  AssetMaintenanceSchedule,
);

@Schema({ _id: false })
export class AssetServiceAttachment {
  @Prop()
  name: string;

  @Prop()
  url: string;

  @Prop({ default: null })
  publicId: string | null;
}
export const AssetServiceAttachmentSchema = SchemaFactory.createForClass(
  AssetServiceAttachment,
);

@Schema({ _id: true, timestamps: false })
export class AssetServiceRecord {
  @Prop()
  recordId: string;

  @Prop()
  date: Date;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  performedBy: Types.ObjectId | null;

  @Prop()
  maintenanceType: string;

  @Prop({ default: '' })
  notes: string;

  @Prop({ default: null })
  nextServiceDate: Date | null;

  @Prop({ default: null })
  nextReviewDate: Date | null;

  @Prop({ type: AssetConditionBreakdownSchema })
  conditionAtService: AssetConditionBreakdown;

  @Prop({ type: [AssetServiceAttachmentSchema], default: [] })
  attachments: AssetServiceAttachment[];

  @Prop({ default: Date.now })
  createdAt: Date;
}
export const AssetServiceRecordSchema =
  SchemaFactory.createForClass(AssetServiceRecord);

@Schema({ _id: true, timestamps: false })
export class AssetImage {
  @Prop()
  url: string;

  @Prop({ default: null })
  publicId: string | null;

  @Prop()
  name: string;

  @Prop({ default: 0 })
  size: number;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  uploadedBy: Types.ObjectId | null;

  @Prop({ default: Date.now })
  uploadedAt: Date;
}
export const AssetImageSchema = SchemaFactory.createForClass(AssetImage);

/**
 * A single physical item within an asset (for example one of three laptops).
 * Captures that item's own condition and details at the time it is added.
 */
@Schema({ _id: false })
export class AssetUnit {
  @Prop({ required: true })
  unitId: string;

  // Serial number or tag that tells this item apart from its siblings.
  @Prop({ default: '' })
  serial: string;

  @Prop({ enum: AssetCondition, default: AssetCondition.GOOD })
  condition: AssetCondition;

  // Why the item is not in good condition, or any detail worth keeping.
  @Prop({ default: '' })
  conditionNote: string;

  @Prop({ type: Date, default: null })
  purchaseDate: Date | null;

  @Prop({ type: Number, default: null })
  value: number | null;

  @Prop({ default: Date.now })
  addedAt: Date;
}
export const AssetUnitSchema = SchemaFactory.createForClass(AssetUnit);

@Schema({ timestamps: true })
export class Asset extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  @Prop()
  name: string;

  @Prop()
  tag: string;

  @Prop()
  category: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Department.name, default: null })
  department: Types.ObjectId | null;

  @Prop({ default: 1 })
  qty: number;

  @Prop({ enum: AssetCondition, default: AssetCondition.GOOD })
  condition: AssetCondition;

  @Prop({ enum: AssetRisk, default: AssetRisk.LOW })
  risk: AssetRisk;

  @Prop({ enum: AssetStatus, default: AssetStatus.ACTIVE })
  status: AssetStatus;

  @Prop({ default: '' })
  description: string;

  @Prop({ default: '' })
  location: string;

  @Prop({ default: '' })
  owner: string;

  @Prop({ default: '' })
  remarks: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  responsibleAdmin: Types.ObjectId | null;

  @Prop({ default: null })
  responsibleManualName: string | null;

  @Prop({ default: null })
  responsibleManualEmail: string | null;

  @Prop({ type: AssetConditionBreakdownSchema })
  conditions: AssetConditionBreakdown;

  @Prop({ type: AssetMaintenanceScheduleSchema })
  schedule: AssetMaintenanceSchedule;

  // One entry per physical item. qty, conditions and condition above are
  // Derived from these whenever they are present.
  @Prop({ type: [AssetUnitSchema], default: [] })
  units: AssetUnit[];

  @Prop({ type: [AssetServiceRecordSchema], default: [] })
  services: AssetServiceRecord[];

  @Prop({ type: [AssetImageSchema], default: [] })
  images: AssetImage[];
}

export const AssetSchema = SchemaFactory.createForClass(Asset);

AssetSchema.index({ churchId: 1, branchId: 1 });
AssetSchema.index({ churchId: 1, tag: 1 }, { unique: true, sparse: true });
