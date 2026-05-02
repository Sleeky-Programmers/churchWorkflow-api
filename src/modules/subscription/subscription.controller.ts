import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SubscriptionService } from './subscription.service';
import { Types } from 'mongoose';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@Controller('subscription')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('overview')
  getBillingOverview(@AuthUser() authUser: Admin) {
    return this.subscriptionService.getBillingOverview(
      new Types.ObjectId(authUser.churchId),
    );
  }

  @Post('update')
  update(@Body() body) {
    return this.subscriptionService.updateSubscription(body);
  }
}
