import { Module } from '@nestjs/common';
import { CurrencyModule } from '../currencies/currency.module';
import { OfferingTypeModule } from '../offering-types/offering-type.module';
import { PaymentMethodModule } from '../payment-methods/payment-method.module';
import { GivingConfigController } from './giving-config.controller';

@Module({
  imports: [CurrencyModule, OfferingTypeModule, PaymentMethodModule],
  controllers: [GivingConfigController],
})
export class GivingConfigModule {}
