import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
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

export class TimerSessionItemDto {
  @IsString()
  @MaxLength(40)
  id: string;

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

export class TimerRunDto {
  @IsBoolean()
  running: boolean;

  // Null when the timer has not been started (or is paused).
  @IsOptional()
  @IsNumber()
  startedAt: number | null;

  @IsNumber()
  @Min(0)
  elapsedBefore: number;

  @IsNumber()
  extraMs: number;
}

export class TimerMessageDto {
  @IsString()
  @MaxLength(80)
  text: string;

  @IsBoolean()
  shown: boolean;
}

/** The whole live session, sent by a controller after every change. */
export class TimerSessionDto {
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => TimerSessionItemDto)
  items: TimerSessionItemDto[];

  @IsInt()
  @Min(0)
  index: number;

  @ValidateNested()
  @Type(() => TimerRunDto)
  timer: TimerRunDto;

  @ValidateNested()
  @Type(() => TimerMessageDto)
  message: TimerMessageDto;

  @Matches(HHMM, { message: 'serviceStart must be a time like 09:00' })
  serviceStart: string;

  // Client id of the device sending it, echoed back so it can skip its own change.
  @IsString()
  @MaxLength(64)
  origin: string;
}
