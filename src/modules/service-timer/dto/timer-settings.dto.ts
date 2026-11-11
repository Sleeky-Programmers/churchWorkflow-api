import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { TIMER_FONTS } from '../../../schemas/timer-settings.schema';

export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
const HEX_MESSAGE = 'must be a colour like #0c1a4d';

export class TimerColorsDto {
  @IsOptional() @Matches(HEX, { message: `bg ${HEX_MESSAGE}` }) bg?: string;
  @IsOptional() @Matches(HEX, { message: `text ${HEX_MESSAGE}` }) text?: string;
  @IsOptional()
  @Matches(HEX, { message: `accent ${HEX_MESSAGE}` })
  accent?: string;
  @IsOptional() @Matches(HEX, { message: `warn ${HEX_MESSAGE}` }) warn?: string;
  @IsOptional() @Matches(HEX, { message: `over ${HEX_MESSAGE}` }) over?: string;
}

export class TimerShowDto {
  @IsOptional() @IsBoolean() timeLeft?: boolean;
  @IsOptional() @IsBoolean() overTime?: boolean;
  @IsOptional() @IsBoolean() labels?: boolean;
  @IsOptional() @IsBoolean() progress?: boolean;
  @IsOptional() @IsBoolean() item?: boolean;
  @IsOptional() @IsBoolean() person?: boolean;
  @IsOptional() @IsBoolean() next?: boolean;
  @IsOptional() @IsBoolean() schedule?: boolean;
  @IsOptional() @IsBoolean() clock?: boolean;
  @IsOptional() @IsBoolean() church?: boolean;
  @IsOptional() @IsBoolean() logo?: boolean;
}

/** Partial update: only the fields sent are changed. */
export class UpdateTimerSettingsDto {
  // Empty string or null goes back to the church's own name.
  @IsOptional()
  @IsString()
  @MaxLength(60)
  churchName?: string | null;

  @IsOptional()
  @Matches(HHMM, { message: 'serviceStart must be a time like 09:00' })
  serviceStart?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60)
  warnMin?: number;

  @IsOptional() @IsBoolean() keepRunning?: boolean;
  @IsOptional() @IsBoolean() shortcuts?: boolean;

  @IsOptional()
  @IsIn(TIMER_FONTS)
  font?: (typeof TIMER_FONTS)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => TimerColorsDto)
  colors?: TimerColorsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TimerShowDto)
  show?: TimerShowDto;
}

export class SetOperatorPinDto {
  @Matches(/^\d{4,8}$/, { message: 'The PIN must be 4 to 8 digits' })
  pin: string;
}

export class OperatorLoginDto {
  @IsString()
  @MaxLength(8)
  pin: string;
}
