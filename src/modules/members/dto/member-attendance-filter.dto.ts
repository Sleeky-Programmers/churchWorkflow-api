import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationBaseDto } from '../../../common/helpers/pagination.helper';

export class MemberAttendanceFilterDto extends PaginationBaseDto {
  @IsOptional()
  @IsString()
  serviceType?: string;

  @IsOptional()
  @IsString()
  serviceId?: string;
}

export class MemberAttendanceStatsFilterDto {
  @Type(() => {
    return Number;
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}
