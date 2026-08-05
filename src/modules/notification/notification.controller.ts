import { Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { PaginationBaseDto } from '../../common/helpers/pagination.helper';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async getNotifications(
    @Query() paginationBaseDto: PaginationBaseDto,
    @AuthUser() authUser: Admin,
  ) {
    return this.notificationService.getNotifications(
      authUser.churchId,
      paginationBaseDto,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Put('read-all')
  async markAllAsRead(@AuthUser() authUser: Admin) {
    return this.notificationService.markAllAsRead(authUser.churchId);
  }

  @UseGuards(JwtAuthGuard)
  @Put(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationService.markAsRead(id);
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Get('admin')
  async getAllNotifications(@Query() paginationBaseDto: PaginationBaseDto) {
    return this.notificationService.getAllNotifications(paginationBaseDto);
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Put('admin/read-all')
  async markAsReadAdmin() {
    return this.notificationService.markAsReadAdmin();
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Put(':id/admin/read')
  async markAllAsReadSystem(@Param('id') id: string) {
    return this.notificationService.markAllAsReadSystem(id);
  }
}
