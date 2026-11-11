import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { FlutterwaveService } from './flutterwave.service';
import { FlutterwaveController } from './flutterwave.controller';
import { PaymentModule } from '../payment/payment.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { CouponModule } from '../coupon/coupon.module';
import { AdminActivityLogModule } from '../admin-activity-log/admin-activity-log.module';
import { ScheduleModule } from '@nestjs/schedule';
import { OnlineGivingModule } from '../online-giving/online-giving.module';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    forwardRef(() => {
      return PaymentModule;
    }),
    forwardRef(() => {
      return SubscriptionModule;
    }),
    CouponModule,
    AdminActivityLogModule,
    ScheduleModule.forRoot(),
    forwardRef(() => {
      return OnlineGivingModule;
    }),
  ],
  controllers: [FlutterwaveController],
  providers: [FlutterwaveService],
  exports: [FlutterwaveService],
})
export class FlutterwaveModule {}
