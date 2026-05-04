import { Controller, Get, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';

@UseGuards(ProductAdminJwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview() {
    return this.analyticsService.getOverviewStats();
  }

  @Get()
  async getAnalytics() {
    return this.analyticsService.getAnalytics();
  }
}
