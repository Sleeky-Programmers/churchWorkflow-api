import { Types } from 'mongoose';

import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { BillingCycle, PlanType } from '../../common/utils/enums.utils';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { SubscriptionService } from './subscription.service';

@Controller('subscription')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('overview')
  getBillingOverview(@AuthUser() authUser: Admin) {
    return this.subscriptionService.getBillingOverview(
      new Types.ObjectId(authUser.churchId),
    );
  }

  @Get('plans')
  getPlans() {
    return this.subscriptionService.getPlans();
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('current-plan')
  getCurrentPlan(@AuthUser() authUser: Admin) {
    return this.subscriptionService.getCurrentPlan(
      new Types.ObjectId(authUser.churchId),
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('plan-change-preview')
  getPlanChangePreview(
    @AuthUser() authUser: Admin,
    @Query('plan') plan: PlanType,
    @Query('billingCycle') billingCycle: BillingCycle,
  ) {
    return this.subscriptionService.getPlanChangePreview(
      new Types.ObjectId(authUser.churchId),
      plan,
      billingCycle,
    );
  }
}
