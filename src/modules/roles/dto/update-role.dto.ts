import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { CreateRoleDto } from './create-role.dto';
import { RoleStatus } from '../../../common/utils/enums.utils';

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class ActivateOrDisableRoleDto {
  @IsNotEmpty()
  @IsEnum(RoleStatus)
  status: RoleStatus;
}
