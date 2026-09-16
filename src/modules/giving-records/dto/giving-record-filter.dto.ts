import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationBaseDto } from '../../../common/helpers/pagination.helper';

export class GivingRecordFilterDto extends PaginationBaseDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsMongoId()
  churchServiceId?: string;
}
