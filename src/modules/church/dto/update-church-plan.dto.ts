import { IsEnum, IsOptional } from 'class-validator';

import { BillingCycle, PlanType } from '../../../common/utils/enums.utils';

export class UpdateChurchPlanDto {
  @IsEnum(PlanType)
  plan: PlanType;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;
}
