import { Controller, Patch, Body, Get, Query, UseGuards } from '@nestjs/common';
import { Admin } from '../../schemas/admin.schema';
import { AdminService } from './admin.service';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { PaginationBaseDto } from 'src/common/helpers/pagination.helper';
import { UpdateAdminDto } from './dto/update-admin.dto';
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async findAll(@AuthUser() authUser: Admin, @Query() dto: PaginationBaseDto) {
    return this.adminService.findAllAdminWithPagination(authUser.churchId, dto);
  }
  @UseGuards(JwtAuthGuard)
@Patch("me")
async updateProfile(
  @AuthUser() authUser: Admin,
  @Body() dto: UpdateAdminDto,
) {
  return this.adminService.updateAdminProfile(authUser._id, dto);
}
}
