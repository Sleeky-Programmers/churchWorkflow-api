import { Controller, Get, UseGuards } from '@nestjs/common';

import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CurrencyService } from '../currencies/currency.service';
import { OfferingTypeService } from '../offering-types/offering-type.service';
import { PaymentMethodService } from '../payment-methods/payment-method.service';

@UseGuards(JwtAuthGuard)
@Controller('giving-config')
export class GivingConfigController {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly offeringTypeService: OfferingTypeService,
    private readonly paymentMethodService: PaymentMethodService,
  ) {}

  @Get('status')
  async status(@CurrentTenant() tenant: TenantContext) {
    const [hasDefaultCurrency, hasDefaultOfferingType, hasActivePaymentMethod] =
      await Promise.all([
        this.currencyService.hasDefault(tenant),
        this.offeringTypeService.hasDefault(tenant),
        this.paymentMethodService.hasActive(tenant),
      ]);

    return {
      hasDefaultCurrency,
      hasDefaultOfferingType,
      hasActivePaymentMethod,
    };
  }
}
