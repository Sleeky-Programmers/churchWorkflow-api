import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { ReportDigestFrequency } from '../../../schemas/report-profile.schema';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export class FeedQueryDto {
  @IsIn(['weekly', 'monthly'])
  period: 'weekly' | 'monthly';

  // How many periods to return (including the one in progress).
  @IsOptional()
  @Type(() => {
    return Number;
  })
  @IsInt()
  @Min(2)
  @Max(12)
  count?: number;

  // 'all', or a branch id. Defaults to the active branch.
  @IsOptional()
  @IsString()
  branch?: string;
}

export class SummaryQueryDto {
  @IsOptional()
  @IsIn(['weekly', 'monthly', 'custom'])
  period?: 'weekly' | 'monthly' | 'custom';

  // Any day inside the week/month wanted (weekly/monthly). Defaults to today.
  @IsOptional()
  @Matches(DATE_RE)
  anchor?: string;

  @IsOptional()
  @Matches(DATE_RE)
  from?: string;

  @IsOptional()
  @Matches(DATE_RE)
  to?: string;

  // Comma-separated section keys to narrow the report further.
  @IsOptional()
  @IsString()
  sections?: string;

  @IsOptional()
  @IsString()
  branch?: string;
}

export class ExportReportDto {
  @IsIn(['xlsx', 'pdf', 'csv'])
  format: 'xlsx' | 'pdf' | 'csv';

  @IsOptional()
  @IsIn(['weekly', 'monthly', 'custom'])
  period?: 'weekly' | 'monthly' | 'custom';

  @IsOptional()
  @Matches(DATE_RE)
  anchor?: string;

  @IsOptional()
  @Matches(DATE_RE)
  from?: string;

  @IsOptional()
  @Matches(DATE_RE)
  to?: string;

  // Omit to use the person's own saved selection.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  sections?: string[];

  @IsOptional()
  @IsString()
  branch?: string;
}

export class SavePreferencesDto {
  @IsIn(['personal', 'church'])
  scope: 'personal' | 'church';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  excludedSections?: string[];

  // Personal only: follow the church default instead of a personal selection.
  @IsOptional()
  @IsBoolean()
  useChurchDefault?: boolean;

  // Personal only.
  @IsOptional()
  @IsIn(Object.values(ReportDigestFrequency))
  digestFrequency?: ReportDigestFrequency;
}
