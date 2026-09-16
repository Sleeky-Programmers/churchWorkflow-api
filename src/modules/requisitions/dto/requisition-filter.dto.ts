import { IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { PaginationBaseDto } from '../../../common/helpers/pagination.helper';
import { RequisitionStatus } from '../../../common/utils/enums.utils';

export class RequisitionFilterDto extends PaginationBaseDto {
  @IsOptional()
  @IsMongoId()
  departmentId?: string;

  @IsOptional()
  @IsEnum(RequisitionStatus)
  status?: RequisitionStatus;
}
