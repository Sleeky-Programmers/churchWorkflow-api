import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const PASTORAL_TRACKING_MODES = [
  'SUNDAYS_ONLY',
  'SUNDAYS_MIDWEEK',
  'ALL_SERVICES',
] as const;

export class UpdatePastoralSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  needsFollowUpThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  atRiskThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  inactiveThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(180)
  archiveAfterDays?: number;

  @IsOptional()
  @IsIn(PASTORAL_TRACKING_MODES)
  trackingMode?: (typeof PASTORAL_TRACKING_MODES)[number];

  @IsOptional()
  @IsBoolean()
  countSpecialEvents?: boolean;

  @IsOptional()
  @IsBoolean()
  countSmallTeams?: boolean;
}

export class AddPastoralNoteDto {
  @IsString()
  @IsNotEmpty()
  body: string;
}
