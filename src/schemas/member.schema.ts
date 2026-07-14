import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import {
  Gender,
  MaritalStatus,
  MembershipStatus,
  MemberTitle,
} from '../common/utils/enums.utils';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Member extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ default: null })
  title: MemberTitle;

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
