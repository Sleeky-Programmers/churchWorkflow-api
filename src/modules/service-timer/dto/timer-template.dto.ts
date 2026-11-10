import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { HHMM } from './timer-settings.dto';

export class TimerTemplateItemDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  person?: string;

  @IsNumber()
  @Min(0)
  @Max(600)
  minutes: number;
}

export class TimerTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  name: string;

  @Matches(HHMM, { message: 'serviceStart must be a time like 09:00' })
  serviceStart: string;

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => TimerTemplateItemDto)
  items: TimerTemplateItemDto[];
}
