import { Controller } from '@nestjs/common';
import { SubscriptionPlanCodesService } from './subscription-plan-codes.service';

@Controller('subscription-plan-codes')
export class SubscriptionPlanCodesController {
  constructor(
    private readonly subscriptionPlanCodesService: SubscriptionPlanCodesService,
  ) {}
}
