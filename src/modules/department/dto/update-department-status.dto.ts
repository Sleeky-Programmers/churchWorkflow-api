import { IsEnum, IsNotEmpty } from 'class-validator';
import { DepartmentStatus } from '../../../common/utils/enums.utils';

export class UpdateDepartmentStatusDto {
  @IsNotEmpty()
  @IsEnum(DepartmentStatus)
  status: DepartmentStatus;
}
