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
import { ChurchServicesService } from './church-services.service';
import { CreateChurchServiceDto } from './dto/create-church-service.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { PaginationBaseDto } from '../../common/helpers/pagination.helper';
import { UpdateChurchServiceDto } from './dto/update-church-service.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ModuleSections, AccessLevel } from '../../common/utils/enums.utils';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('church-services')
export class ChurchServicesController {
  constructor(private readonly churchServicesService: ChurchServicesService) {}

  @Post()
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.MANAGE,
  })
  createChurchService(
    @Body() createChurchServiceDto: CreateChurchServiceDto,
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
  ) {
    return this.churchServicesService.create(
      authUser,
      tenant,
      createChurchServiceDto,
    );
  }

  @Get()
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.VIEW,
  })
  getAllChurchServices(
    @CurrentTenant() tenant: TenantContext,
    @Query() paginationBaseDto: PaginationBaseDto,
  ) {
    return this.churchServicesService.findAll(tenant, paginationBaseDto);
  }

  @Get('by-date')
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.VIEW,
  })
  getServicesByDate(
    @CurrentTenant() tenant: TenantContext,
    @Query('date') date: string,
  ) {
    return this.churchServicesService.getServicesByDate(new Date(date), tenant);
  }

  @Get('search')
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.VIEW,
  })
  getServicesFiltered(
    @CurrentTenant() tenant: TenantContext,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('day') day?: string,
  ) {
    const serviceYear = year ? parseInt(year, 10) : undefined;
    const serviceMonth = month ? parseInt(month, 10) : undefined;
    const serviceDay = day ? parseInt(day, 10) : undefined;
    return this.churchServicesService.getServicesFiltered(
      tenant,
      serviceYear,
      serviceMonth,
      serviceDay,
    );
  }

  @Get(':id')
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.VIEW,
  })
  getChurchServiceById(@Param('id') id: string) {
    return this.churchServicesService.findById(id);
  }

  @Put(':id')
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.MANAGE,
  })
  updateChurchService(
    @Param('id') id: string,
    @Body() updateChurchServiceDto: UpdateChurchServiceDto,
  ) {
    return this.churchServicesService.update(id, updateChurchServiceDto);
  }

  @Delete(':id')
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.MANAGE,
  })
  deleteChurchService(@Param('id') id: string) {
    return this.churchServicesService.delete(id);
  }

  @Post(':id/regenerate-instances')
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.MANAGE,
  })
  regenerateInstances(@Param('id') id: string) {
    return this.churchServicesService.regenerateInstancesForService(id);
  }
}
