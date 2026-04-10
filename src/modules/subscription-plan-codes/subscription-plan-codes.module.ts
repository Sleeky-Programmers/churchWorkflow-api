import { Module } from '@nestjs/common';
import { SubscriptionPlanCodesService } from './subscription-plan-codes.service';
import { SubscriptionPlanCodesController } from './subscription-plan-codes.controller';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SubscriptionPlanCodes,
  SubscriptionPlanCodesSchema,
} from '../../schemas/subscription-plan-codes.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SubscriptionPlanCodes.name, schema: SubscriptionPlanCodesSchema },
    ]),
  ],
  controllers: [SubscriptionPlanCodesController],
  providers: [SubscriptionPlanCodesService],
  exports: [SubscriptionPlanCodesService],
})
export class SubscriptionPlanCodesModule {}
