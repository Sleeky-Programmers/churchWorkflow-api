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

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  code?: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsEnum(CouponType)
  @IsNotEmpty()
  type: CouponType;

  @IsEnum(DiscountType)
  @IsNotEmpty()
  discountType: DiscountType;

  @IsNumber()
  @Min(0.01)
  @IsNotEmpty()
  discount: number;

  @IsDateString()
  @IsNotEmpty()
  @ValidateIf((o) => o.validFrom !== undefined)
  validFrom?: string;

  @IsDateString()
  @IsNotEmpty()
  expiryDate: string;

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
