import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';
import { PaginationBaseDto } from 'src/common/helpers/pagination.helper';

import { MembershipStatus } from '../../../common/utils/enums.utils';

export class MemberManagementDto extends PaginationBaseDto {
  @IsOptional()
  @IsMongoId()
  churchId?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  status?: boolean;

  @IsOptional()
  @IsEnum(MembershipStatus)
  membershipStatus?: MembershipStatus;

  @IsOptional()
  @IsString()
  role?: string;
}
