import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';

import { OperatorLoginDto } from './dto/timer-settings.dto';
import { ServiceTimerService } from './service-timer.service';

/**
 * No login: display screens open with a secret link and need no account
 * (Product Plan, section 5.4), and volunteers unlock control with the
 * operator PIN. Wrong PINs are counted and lock the PIN for a few minutes.
 */
@Controller('service-timer/public')
export class ServiceTimerPublicController {
  constructor(private readonly timer: ServiceTimerService) {}

  @Get(':displayToken')
  snapshot(@Param('displayToken') displayToken: string) {
    return this.timer.publicSnapshot(displayToken);
  }

  @Post(':displayToken/operator')
  @HttpCode(200)
  operatorLogin(
    @Param('displayToken') displayToken: string,
    @Body() dto: OperatorLoginDto,
  ) {
    return this.timer.operatorLogin(displayToken, dto.pin);
  }
}
