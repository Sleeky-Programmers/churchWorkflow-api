import { IsOptional, IsString } from 'class-validator';

export class GivingSummaryFilterDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
