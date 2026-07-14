// Update-coupon.dto.ts
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  CouponStatus,
  CouponType,
  DiscountType,
  PlanType,
} from 'src/common/utils/enums.utils';

export class UpdateCouponDto {
  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.code !== undefined)
  @IsNotEmpty()
  code?: string;

  @IsString()
  @IsOptional()
  @ValidateIf((o) => o.description !== undefined)
  @IsNotEmpty()
  description?: string;

  @IsEnum(CouponType)
  @IsOptional()
  type?: CouponType;

  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: DiscountType;

  @IsNumber()
  @Min(0.01)
  @IsOptional()
  discount?: number;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  maxUsage?: number;

  @IsEnum(PlanType)
  @IsOptional()
  minPlanTier?: PlanType;

  @IsArray()
  @IsEnum(PlanType, { each: true })
  @IsOptional()
  excludedPlans?: PlanType[];

  @IsBoolean()
  @IsOptional()
  isStackable?: boolean;

  @IsBoolean()
  @IsOptional()
  isTransferable?: boolean;

  @IsEnum(CouponStatus)
  @IsOptional()
  status?: CouponStatus;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isSystemGenerated?: boolean;
}
