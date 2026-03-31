import { IsArray, IsEnum, IsMongoId, IsNotEmpty } from 'class-validator';
import { DepartmentMemberAction } from '../../../common/utils/enums.utils';

export class UpdateDepartmentMembersDto {
  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  memberIds: string[];

  @IsNotEmpty()
  @IsEnum(DepartmentMemberAction)
  action: DepartmentMemberAction;
}
