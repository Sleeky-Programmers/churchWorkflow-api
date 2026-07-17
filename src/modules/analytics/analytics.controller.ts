import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';

@UseGuards(ProductAdminJwtAuthGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  async getOverview() {
    return this.analyticsService.getOverviewStats();
  }

  @Get()
  async getAnalytics(@Query() filterDto: AnalyticsFilterDto) {
    return this.analyticsService.getAnalytics(filterDto);
  }
}
