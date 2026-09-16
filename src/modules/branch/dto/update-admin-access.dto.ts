import { IsArray, IsEnum, IsMongoId, IsOptional } from 'class-validator';
import { AdminAccessScope } from '../../../common/utils/enums.utils';

export class UpdateAdminAccessDto {
  @IsEnum(AdminAccessScope)
  accessScope: AdminAccessScope;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  branchIds?: string[];
}
