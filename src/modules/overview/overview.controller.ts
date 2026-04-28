import { Controller, Get, UseGuards } from '@nestjs/common';
import { OverviewService } from './overview.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('overview')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get()
  async getOverview() {
    return this.overviewService.getOverview();
  }
}
