// Analytics/dto/analytics-filter.dto.ts
import { IsEnum, IsOptional } from 'class-validator';
import { AnalyticsPeriod } from 'src/common/utils/enums.utils';

export class AnalyticsFilterDto {
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;
}
