import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

import {
  CouponFilter,
  CouponStatus,
  CouponType,
  MemberFilter,
} from '../utils/enums.utils';

interface PaginationMetaInterface {
  page: number;
  limit: number;
  itemCount: number;
}

export const paginationMeta = ({
  page,
  limit,
  itemCount,
}: PaginationMetaInterface) => {
  const totalPages = Math.ceil(itemCount / limit);

  return {
    page,
    limit,
    itemCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
};

export class PaginationBaseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit?: number = 20;

  @IsOptional()
  @IsString()
  search?: string;
}

export class MembersFilterDto extends PaginationBaseDto {
  @IsOptional()
  @IsString()
  filter?: MemberFilter;
}

export class CouponFilterDto extends PaginationBaseDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsEnum(CouponFilter)
  @IsOptional()
  filter?: CouponFilter;

  @IsEnum(CouponType)
  @IsOptional()
  type?: CouponType;

  @IsEnum(CouponStatus)
  @IsOptional()
  status?: CouponStatus;

  @IsString()
  @IsOptional()
  sortBy?: string;

  @IsEnum(['ASC', 'DESC'])
  @IsOptional()
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
