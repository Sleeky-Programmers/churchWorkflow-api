import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  Gender,
  MaritalStatus,
  MembershipStatus,
} from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class Member extends Document {
  @Prop()
  title: string;

  @Prop()
  fullName: string;

  @Prop()
  gender: Gender;

  @Prop()
  birthday: Date;

  @Prop()
  maritalStatus: MaritalStatus;

  @Prop()
  dateOfMarriage: Date;

  @Prop()
  spouseFirstName: string;

  @Prop()
  spouseLastName: string;

  @Prop()
  phoneNumber: string;

  @Prop()
  email: string;

  @Prop()
  occupation: string;

  @Prop()
  educationalBackground: string;

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
}

export const MemberSchema = SchemaFactory.createForClass(Member);
