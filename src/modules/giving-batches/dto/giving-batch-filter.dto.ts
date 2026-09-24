import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';
import { PaginationBaseDto } from '../../../common/helpers/pagination.helper';
import { GivingBatchStatus } from '../../../schemas/giving-batch.schema';

export class GivingBatchFilterDto extends PaginationBaseDto {
  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsEnum(GivingBatchStatus)
  status?: GivingBatchStatus;

  @IsOptional()
  @IsMongoId()
  churchServiceId?: string;
}
