import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Admin } from './admin.schema';

/**
 * A one-time code that signs the same user in to another of our apps
 * (e.g. from the Service Timer into Church Workflow) without a password.
 * Only a hash of the code is stored; it works once and expires quickly.
 */
@Schema({ timestamps: true })
export class AuthHandoff extends Document {
  @Prop({ required: true, unique: true })
  codeHash: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, required: true })
  adminId: Types.ObjectId;

  // The branch they were on, so the other app opens on the same one.
  @Prop({ type: SchemaTypes.ObjectId, default: null })
  activeBranchId: Types.ObjectId | null;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date, default: null })
  usedAt: Date | null;
}
export const AuthHandoffSchema = SchemaFactory.createForClass(AuthHandoff);

// MongoDB deletes codes once they expire.
AuthHandoffSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
