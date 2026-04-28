import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ProductAdminRolesService } from './product-admin-roles.service';
import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';

@UseGuards(ProductAdminJwtAuthGuard)
@Controller('product-admin-roles')
export class ProductAdminRolesController {
  constructor(private readonly rolesService: ProductAdminRolesService) {}

  @Post()
  async create(@Body() body: any) {
    return this.rolesService.create(body);
  }

  @Get()
  async list() {
    return this.rolesService.list();
  }
}
