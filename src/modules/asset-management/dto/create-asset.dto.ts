import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsNumber,
  MaxLength,
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
  AssetCondition,
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

export class AssetUnitDto {
  // Present when editing an existing unit; omitted for new ones.
  @IsOptional()
  @IsString()
  @MaxLength(60)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serial?: string;

  @IsEnum(AssetCondition)
  condition: AssetCondition;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  conditionNote?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number;
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

  // Legacy shape: still accepted when no units are sent.
  @IsOptional()
  @ValidateNested()
  @Type(() => AssetConditionBreakdownDto)
  conditions?: AssetConditionBreakdownDto;

  // One entry per physical item, each with its own condition and details.
  @IsOptional()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => AssetUnitDto)
  units?: AssetUnitDto[];

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
