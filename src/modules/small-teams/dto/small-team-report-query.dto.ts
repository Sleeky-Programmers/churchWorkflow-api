import { IsDateString, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class SmallTeamReportQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @Type(() => {
    return Number;
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  lowAttendanceThreshold?: number = 50;
}
