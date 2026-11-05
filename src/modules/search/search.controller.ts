import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { GlobalSearchDto } from './search.dto';
import { SearchThrottleGuard } from './search-throttle.guard';
import { SearchService } from './search.service';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * Header search. No @RequirePermissions: each record type is checked
   * against the role inside the service, and types it can't view are left out.
   */
  @UseGuards(JwtAuthGuard, SearchThrottleGuard)
  @Get()
  search(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Query() dto: GlobalSearchDto,
  ) {
    return this.searchService.search(authUser, tenant, dto.q, dto.limit ?? 5);
  }
}
