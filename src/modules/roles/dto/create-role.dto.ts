import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccessLevel, ModuleSections } from '../../../common/utils/enums.utils';

class SectionPermissionDto {
  @IsEnum(ModuleSections)
  moduleSection: ModuleSections;

  @IsEnum(AccessLevel)
  accessLevel: AccessLevel;
}

export class CreateRoleDto {
  @IsNotEmpty()
  roleName: string;

  @IsOptional()
  description: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => SectionPermissionDto)
  permissions: SectionPermissionDto[];
}
