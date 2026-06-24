// Validate-coupon.dto.ts
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';
import { PlanType } from 'src/common/utils/enums.utils';

export class ValidateCouponDto {
  @IsString()
  @IsNotEmpty({ message: 'Coupon code is required' })
  @Matches(/^[A-Z0-9_]+$/, {
    message:
      'Coupon code can only contain uppercase letters, numbers, and underscores',
  })
  code: string;

  @IsEnum(PlanType)
  @IsOptional()
  planType?: PlanType;

  @IsString()
  @IsOptional()
  churchId?: string;
}
