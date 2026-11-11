import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import {
  DismissSuggestionDto,
  SuggestionsQueryDto,
  TrackUsageDto,
} from './dto/suggestions.dto';
import { SuggestionsService } from './suggestions.service';

// Open to every signed-in admin: suggestions only ever draw on the caller's
// Own usage, and each suggestion is filtered by the caller's own permissions.
@UseGuards(JwtAuthGuard)
@Controller('suggestions')
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Post('track')
  @HttpCode(200)
  track(@AuthUser() authUser: Admin, @Body() dto: TrackUsageDto) {
    return this.suggestionsService.track(authUser, dto.events);
  }

  @Get()
  async list(@AuthUser() authUser: Admin, @Query() query: SuggestionsQueryDto) {
    const suggestions = await this.suggestionsService.getSuggestions(
      authUser,
      (authUser as any).tenant,
      query.current,
    );
    return { suggestions };
  }

  @Post('dismiss')
  @HttpCode(200)
  dismiss(@AuthUser() authUser: Admin, @Body() dto: DismissSuggestionDto) {
    return this.suggestionsService.dismiss(authUser, dto.suggestionId);
  }
}
