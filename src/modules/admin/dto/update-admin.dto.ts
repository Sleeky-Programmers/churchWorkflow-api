import { PartialType } from '@nestjs/mapped-types';
import { CreateSuperAdminDto } from './create-super-admin.dto';
import { CreateAdminDto } from './create-admin.dto';

export class UpdateSuperAdminDto extends PartialType(CreateSuperAdminDto) {}
export class UpdateAdminDto extends PartialType(CreateAdminDto) {}
