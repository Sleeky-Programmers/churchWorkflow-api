import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationService } from './location.service';

@UseGuards(JwtAuthGuard)
@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get()
  findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination =
      page !== undefined || limit !== undefined
        ? {
            page: Math.max(Number(page) || 1, 1),
            limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
          }
        : undefined;

    return this.locationService.findAll(tenant, pagination);
  }

  @Post()
  create(@AuthUser() authUser: Admin, @Body() dto: CreateLocationDto) {
    return this.locationService.create(authUser, dto);
  }

  @Put(':id')
  update(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.locationService.update(authUser, id, dto);
  }

  @Delete(':id')
  remove(@AuthUser() authUser: Admin, @Param('id') id: string) {
    return this.locationService.remove(authUser, id);
  }
}
