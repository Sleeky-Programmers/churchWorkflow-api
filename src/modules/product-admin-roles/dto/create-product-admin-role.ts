import { IsObject, IsOptional, IsString } from 'class-validator';
import { ModulePermissions } from '../../../schemas/product-admin-role.schema';

export class CreateProductAdminRoleDto {
  @IsString()
  name: string;

  @IsObject()
  @IsOptional()
  permissions: Record<string, ModulePermissions>;
}
