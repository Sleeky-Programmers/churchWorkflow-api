import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import {
  Gender,
  MaritalStatus,
  MembershipStatus,
} from '../../../common/utils/enums.utils';
import { TITLE_MAX_LENGTH } from '../../../common/utils/titles.constant';

export class CreateMemberDto {
  // Free text rather than a fixed enum - the title catalog
  // (common/utils/titles.constant.ts) is suggestions, not a restriction.
  @IsOptional()
  @IsString()
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;

  @IsNotEmpty()
  fullName: string;

  @IsNotEmpty()
  @IsEnum(Gender)
  gender: Gender;

  @IsOptional()
  birthday?: Date;

  @IsOptional()
  @IsEnum(MaritalStatus)
  maritalStatus?: MaritalStatus;

  @IsOptional()
  dateOfMarriage?: Date;

  @IsOptional()
  phoneNumber?: string;

  @IsOptional()
  email?: string;

  @IsOptional()
  occupation?: string;

  @IsOptional()
  address?: string;

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
