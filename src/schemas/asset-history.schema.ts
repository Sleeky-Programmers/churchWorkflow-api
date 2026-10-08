import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

import { Admin } from './admin.schema';
import { Asset } from './asset.schema';
import { Branch } from './branch.schema';
import { Church } from './church.schema';

export type AssetHistoryTone = 'green' | 'amber' | 'purple' | 'blue';

@Schema({ _id: false })
export class AssetHistoryFieldChange {
  @Prop()
  from: string;

  @Prop()
  to: string;
}
export const AssetHistoryFieldChangeSchema = SchemaFactory.createForClass(
  AssetHistoryFieldChange,
);

@Schema({ timestamps: true })
export class AssetHistory extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Asset.name })
  assetId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  adminId: Types.ObjectId | null;

  @Prop()
  actorName: string;

  @Prop()
  action: string;

  @Prop({ type: Map, of: AssetHistoryFieldChangeSchema, default: {} })
  changes: Map<string, AssetHistoryFieldChange>;

  @Prop({ default: 'blue' })
  tone: AssetHistoryTone;
}

export const AssetHistorySchema = SchemaFactory.createForClass(AssetHistory);
AssetHistorySchema.index({ assetId: 1, createdAt: -1 });
