import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { InitializeGivingDto } from './dto/initialize-giving.dto';
import { OnlineGivingService } from './online-giving.service';

// Public, unauthenticated donor-facing endpoints - no JwtAuthGuard or
// PermissionsGuard here on purpose. Churches are resolved by slug so the
// Raw churchId is never exposed in these URLs.
@Controller()
export class OnlineGivingController {
  constructor(private readonly onlineGivingService: OnlineGivingService) {}

  @Get('public/churches/:churchSlug/giving-options')
  getGivingOptions(@Param('churchSlug') churchSlug: string) {
    return this.onlineGivingService.getGivingOptions(churchSlug);
  }

  @Post('public/churches/:churchSlug/giving/initialize')
  initialize(
    @Param('churchSlug') churchSlug: string,
    @Body() dto: InitializeGivingDto,
  ) {
    return this.onlineGivingService.initialize(churchSlug, dto);
  }

  @Get('public/giving/:reference/verify')
  verify(@Param('reference') reference: string) {
    return this.onlineGivingService.verify(reference);
  }
}
