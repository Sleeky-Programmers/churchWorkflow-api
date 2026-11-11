import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import {
  PlanPricing,
  PlanPricingSchema,
} from '../../schemas/plan-pricing.schema';
import {
  Subscription,
  SubscriptionSchema,
} from '../../schemas/subscription.schema';
import { PaymentModule } from '../payment/payment.module';
import { AdminActivityLogModule } from '../admin-activity-log/admin-activity-log.module';
import { NotificationModule } from '../notification/notification.module';
import { SubscriptionPlanCodesModule } from '../subscription-plan-codes/subscription-plan-codes.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: PlanPricing.name, schema: PlanPricingSchema },
    ]),
    forwardRef(() => {
      return PaymentModule;
    }),
    AdminActivityLogModule,
    NotificationModule,
    SubscriptionPlanCodesModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
