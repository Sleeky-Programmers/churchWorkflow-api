import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, Document } from 'mongoose';
import { AdminAccessScope } from '../common/utils/enums.utils';
import { Branch } from './branch.schema';
import { Church } from './church.schema';
import { Role } from './role.schema';

@Schema({ timestamps: true })
export class Admin extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Role.name })
  churchRole: Types.ObjectId;

  @Prop({
    type: String,
    enum: AdminAccessScope,
    default: AdminAccessScope.BRANCH,
  })
  accessScope: AdminAccessScope;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  defaultBranchId: Types.ObjectId | null;

  @Prop({ default: null })
  title: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop({ default: null })
  phoneNumber: string;

  @Prop()
  email: string;

  @Prop({ select: false })
  password: string;

  @Prop({ default: false })
  isVerified: boolean;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
