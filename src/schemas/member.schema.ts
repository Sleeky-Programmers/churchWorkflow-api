import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import {
  Gender,
  MaritalStatus,
  MembershipStatus,
} from '../common/utils/enums.utils';
import { Branch } from './branch.schema';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Member extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  // Free text (see CreateMemberDto) rather than a fixed enum.
  @Prop({ default: null })
  title: string | null;

  @Prop()
  fullName: string;

  @Prop()
  gender: Gender;

  @Prop()
  birthday: Date;

  @Prop({ default: null })
  maritalStatus: MaritalStatus;

  @Prop({ default: null })
  dateOfMarriage: Date;

  @Prop({ default: null })
  phoneNumber: string;

  @Prop({ default: null })
  email: string;

  @Prop({ default: null })
  occupation: string;

  @Prop({ default: null })
  educationalBackground: string;

  @Prop({ default: null })
  address: string;

  @Prop({ default: null })
  membershipStatus: MembershipStatus;

  @Prop({ default: null })
  dateJoined: Date;

  @Prop({ default: null })
  previousChurchMembership: string;

  @Prop({ default: null })
  isBaptized: boolean;

  @Prop({ default: null })
  ministries: string;

  @Prop({ default: null })
  volunteerPreferences: string;

  @Prop({ default: null })
  cellGroupName: string;

  @Prop({ default: false })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const MemberSchema = SchemaFactory.createForClass(Member);

MemberSchema.index({ churchId: 1, branchId: 1 });
