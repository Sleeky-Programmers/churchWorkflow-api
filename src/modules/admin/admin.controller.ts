import {
  Controller,
  Patch,
  Body,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Admin } from '../../schemas/admin.schema';
import { AdminService } from './admin.service';
import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { AdminFilterDto } from 'src/common/helpers/pagination.helper';
import { UpdateAdminDto } from './dto/update-admin.dto';

@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  async findAll(@AuthUser() authUser: Admin, @Query() dto: AdminFilterDto) {
    return this.adminService.findAllAdminWithPagination(authUser.churchId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateProfile(
    @AuthUser() authUser: Admin,
    @Body() dto: UpdateAdminDto,
  ) {
    return this.adminService.updateAdminProfile(authUser._id, dto);
  }
  @Get('stats')
  async getStats(@AuthUser() authUser: Admin) {
    return this.adminService.stats(authUser.churchId);
  }

  @Patch(':id/block')
  async block(@Param('id') id: string) {
    return this.adminService.blockAdmin(id);
  }

  @Patch(':id/unblock')
  async unblock(@Param('id') id: string) {
    return this.adminService.unblockAdmin(id);
  }
}
