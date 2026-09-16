import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationBaseDto } from '../../../common/helpers/pagination.helper';

export class ExpenseFilterDto extends PaginationBaseDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsMongoId()
  departmentId?: string;
}
