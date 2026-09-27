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
import { CreatePaymentMethodDto } from './dto/create-payment-method.dto';
import { UpdatePaymentMethodDto } from './dto/update-payment-method.dto';
import { PaymentMethodService } from './payment-method.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('payment-methods')
export class PaymentMethodController {
  constructor(private readonly paymentMethodService: PaymentMethodService) {}

  @Get()
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  findAll(@CurrentTenant() tenant: TenantContext) {
    return this.paymentMethodService.findAll(tenant);
  }

  @Get('presets')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  getPresets() {
    return this.paymentMethodService.getPresets();
  }

  @Post()
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  create(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreatePaymentMethodDto,
  ) {
    return this.paymentMethodService.create(tenant, dto);
  }

  @Put(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  update(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentMethodDto,
  ) {
    return this.paymentMethodService.update(tenant, id, dto);
  }

  @Delete(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  remove(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.paymentMethodService.remove(tenant, id);
  }
}
