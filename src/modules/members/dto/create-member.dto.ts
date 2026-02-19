import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';
import {
  Gender,
  MaritalStatus,
  MembershipStatus,
  MemberTitle,
} from '../../../common/utils/enums.utils';

export class CreateMemberDto {
  @IsOptional()
  @IsEnum(MemberTitle)
  title: string;

  @IsNotEmpty()
  fullName: string;

  @IsNotEmpty()
  @IsEnum(Gender)
  gender: string;

  @IsNotEmpty()
  birthday: Date;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: string;

  @IsOptional()
  dateOfMarriage?: Date;

  @IsOptional()
  spouseFirstName?: string;

  @IsOptional()
  spouseLastName?: string;

  @IsOptional()
  phoneNumber?: string;

  @IsOptional()
  email?: string;

  @IsOptional()
  occupation?: string;

  @IsOptional()
  educationalBackground?: string;

  @IsOptional()
  @IsEnum(MembershipStatus)
  membershipStatus?: MembershipStatus;

  @IsOptional()
  dateJoined?: Date;

  @IsOptional()
  previousChurchMembership?: string;

  @IsOptional()
  isBaptized?: boolean;

  @IsOptional()
  ministries?: string;

  @IsOptional()
  volunteerPreferences?: string;

  @IsOptional()
  cellGroupName?: string;
}
