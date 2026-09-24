import {
  Body,
  Controller,
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
import { CurrencyService } from './currency.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('currencies')
export class CurrencyController {
  constructor(private readonly currencyService: CurrencyService) {}

  @Get()
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  findAll(@CurrentTenant() tenant: TenantContext) {
    return this.currencyService.findAll(tenant);
  }

  @Post()
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateCurrencyDto,
  ) {
    return this.currencyService.create(tenant, dto);
  }

  @Put(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateCurrencyDto,
  ) {
    return this.currencyService.update(tenant, id, dto);
  }

  @Put(':id/set-default')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  setDefault(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.currencyService.setDefault(tenant, id);
  }
}
