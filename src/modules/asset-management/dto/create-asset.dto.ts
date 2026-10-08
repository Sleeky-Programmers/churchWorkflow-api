import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  AssetRisk,
  AssetStatus,
} from '../../../common/utils/enums.utils';

export class AssetConditionBreakdownDto {
  @IsInt()
  @Min(0)
  good: number;

  @IsInt()
  @Min(0)
  fair: number;

  @IsInt()
  @Min(0)
  repair: number;

  @IsInt()
  @Min(0)
  damaged: number;
}

export class CreateAssetDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsNotEmpty()
  @IsString()
  category: string;

  @IsOptional()
  @IsMongoId()
  department?: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  owner?: string;

  @IsNotEmpty()
  @IsIn(['system', 'manual'])
  responsibleMode: 'system' | 'manual';

  @IsOptional()
  @IsMongoId()
  responsibleAdmin?: string;

  @IsOptional()
  @IsString()
  responsibleManualName?: string;

  @IsOptional()
  @IsEmail()
  responsibleManualEmail?: string;

  @ValidateNested()
  @Type(() => AssetConditionBreakdownDto)
  conditions: AssetConditionBreakdownDto;

  @IsNotEmpty()
  @IsEnum(AssetRisk)
  risk: AssetRisk;

  @IsNotEmpty()
  @IsEnum(AssetStatus)
  status: AssetStatus;

  @IsBoolean()
  maintenanceEnabled: boolean;

  @IsOptional()
  @IsString()
  frequency?: string;

  @IsOptional()
  @IsDateString()
  lastService?: string;

  @IsOptional()
  @IsDateString()
  lastReview?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}
