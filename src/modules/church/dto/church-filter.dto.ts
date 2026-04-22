import { IsOptional, IsString } from 'class-validator';
import { PaginationBaseDto } from '../../../common/helpers/pagination.helper';

export class ChurchFilterDto extends PaginationBaseDto {
  @IsOptional()
  @IsString()
  plan?: string;
}
