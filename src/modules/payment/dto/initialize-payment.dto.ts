import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  BillingCycle,
  PlanType,
  PaymentProvider,
} from '../../../common/utils/enums.utils';

export class InitializePaymentDto {
  @IsEnum(PlanType)
  plan: PlanType;

  @IsEnum(BillingCycle)
  billingCycle: BillingCycle;

  @IsOptional()
  @IsString()
  promoCode?: string;

  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;

  @IsEnum(PaymentProvider)
  provider: PaymentProvider;
}
