import { timingSafeEqual } from 'crypto';

import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { GuestLifecycleService } from './guest-lifecycle.service';

/**
 * Cron entry points for serverless deployments (Vercel Cron calls these with
 * `Authorization: Bearer $CRON_SECRET`). Vercel Cron issues GET requests, so
 * both GET and POST are accepted.
 */
@Controller('internal/cron')
export class InternalCronController {
  constructor(
    private readonly guestLifecycleService: GuestLifecycleService,
    private readonly configService: ConfigService,
  ) {}

  private assertAuthorized(authorization?: string) {
    const secret = this.configService.get<string>('cron.secret');
    const expected = Buffer.from(`Bearer ${secret ?? ''}`);
    const given = Buffer.from(authorization ?? '');
    if (
      !secret ||
      expected.length !== given.length ||
      !timingSafeEqual(expected, given)
    ) {
      throw new UnauthorizedException();
    }
  }

  @Get('guest-lifecycle')
  @HttpCode(200)
  runGet(@Headers('authorization') authorization?: string) {
    this.assertAuthorized(authorization);
    return this.guestLifecycleService.runDaily();
  }

  @Post('guest-lifecycle')
  @HttpCode(200)
  runPost(@Headers('authorization') authorization?: string) {
    this.assertAuthorized(authorization);
    return this.guestLifecycleService.runDaily();
  }
}
