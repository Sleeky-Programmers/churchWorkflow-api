import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { DiscountType } from '../../../common/utils/enums.utils';

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber()
  discount: number;

  @IsNumber()
  @IsOptional()
  maxUsage?: number;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
