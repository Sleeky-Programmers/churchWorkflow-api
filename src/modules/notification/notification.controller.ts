import { Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { Admin } from '../../schemas/admin.schema';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  async getNotifications(@AuthUser() authUser: Admin) {
    return this.notificationService.getNotifications(authUser.churchId);
  }

  @Put('read-all')
  async markAllAsRead(@AuthUser() authUser: Admin) {
    return this.notificationService.markAllAsRead(authUser.churchId);
  }

  @Put(':id/read')
  async markAsRead(@Param('id') id: string) {
    return this.notificationService.markAsRead(id);
  }
}
