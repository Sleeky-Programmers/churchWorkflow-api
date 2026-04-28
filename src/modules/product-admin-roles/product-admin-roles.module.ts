import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ProductAdminRole,
  ProductAdminRoleSchema,
} from '../../schemas/product-admin-role.schema';
import { ProductAdminRolesController } from './product-admin-roles.controller';
import { ProductAdminRolesService } from './product-admin-roles.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductAdminRole.name, schema: ProductAdminRoleSchema },
    ]),
  ],
  providers: [ProductAdminRolesService],
  controllers: [ProductAdminRolesController],
  exports: [ProductAdminRolesService],
})
export class ProductAdminRolesModule {}
