import { IsOptional, IsString } from 'class-validator';

export class ExpenseSummaryFilterDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
