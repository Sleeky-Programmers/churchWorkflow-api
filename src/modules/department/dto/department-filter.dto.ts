import { IsOptional, IsString, IsEnum, IsMongoId } from 'class-validator';
import { PaginationBaseDto } from '../../../common/helpers/pagination.helper';
import { DepartmentStatus } from '../../../common/utils/enums.utils';

export class DepartmentFilterDto extends PaginationBaseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsMongoId()
  hod?: string;

  @IsOptional()
  @IsEnum(DepartmentStatus)
  status?: DepartmentStatus;
}
