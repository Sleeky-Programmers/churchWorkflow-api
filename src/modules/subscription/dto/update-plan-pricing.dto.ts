import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdatePlanPricingDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearlyPrice?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @IsOptional()
  @IsNumber()
  @Min(-1)
  memberLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1)
  guestLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1)
  userLimit?: number;

  @IsOptional()
  @IsNumber()
  @Min(-1)
  branchLimit?: number;

  @IsOptional()
  @IsBoolean()
  customRolesEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  popular?: boolean;

  @IsOptional()
  @IsBoolean()
  contactSales?: boolean;
}
