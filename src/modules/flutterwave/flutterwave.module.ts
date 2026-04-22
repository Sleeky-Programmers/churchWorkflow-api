import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { FlutterwaveService } from './flutterwave.service';
import { FlutterwaveController } from './flutterwave.controller';
import { PaymentModule } from '../payment/payment.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CouponModule } from '../coupon/coupon.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    forwardRef(() => PaymentModule),
    forwardRef(() => SubscriptionModule),
    CouponModule,
  ],
  controllers: [FlutterwaveController],
  providers: [FlutterwaveService],
  exports: [FlutterwaveService],
})
export class FlutterwaveModule {}
