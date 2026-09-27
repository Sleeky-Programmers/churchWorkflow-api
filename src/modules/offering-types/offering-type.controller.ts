import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';

import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../common/utils/enums.utils';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CreateOfferingTypeDto } from './dto/create-offering-type.dto';
import { UpdateOfferingTypeDto } from './dto/update-offering-type.dto';
import { OfferingTypeService } from './offering-type.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('offering-types')
export class OfferingTypeController {
  constructor(private readonly offeringTypeService: OfferingTypeService) {}

  @Get()
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  findAll(@CurrentTenant() tenant: TenantContext) {
    return this.offeringTypeService.findAll(tenant);
  }

  @Post()
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateOfferingTypeDto,
  ) {
    return this.offeringTypeService.create(tenant, dto);
  }

  @Put(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateOfferingTypeDto,
  ) {
    return this.offeringTypeService.update(tenant, id, dto);
  }

  @Put(':id/set-default')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  setDefault(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.offeringTypeService.setDefault(tenant, id);
  }

  @Delete(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.offeringTypeService.remove(tenant, id);
  }
}
