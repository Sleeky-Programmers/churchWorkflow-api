import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { GivingEntryDto } from './giving-entry.dto';

export class CreateGivingBatchDto {
  @IsNotEmpty()
  @IsMongoId()
  churchServiceId: string;

  // 'YYYY-MM-DD'
  @IsNotEmpty()
  @IsString()
  date: string;

  @IsOptional()
  @IsString()
  countedWith?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => GivingEntryDto)
  entries: GivingEntryDto[];
}
