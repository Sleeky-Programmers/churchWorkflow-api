import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { PaystackService } from './paystack.service';
import { PaystackController } from './paystack.controller';
import { PaymentModule } from '../payment/payment.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CouponModule } from '../coupon/coupon.module';
import { SubscriptionPlanCodesModule } from '../subscription-plan-codes/subscription-plan-codes.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => SubscriptionModule),
    CouponModule,
    SubscriptionPlanCodesModule,
  ],
  controllers: [PaystackController],
  providers: [PaystackService],
  exports: [PaystackService],
})
export class PaystackModule {}
