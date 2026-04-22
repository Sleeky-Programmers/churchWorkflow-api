import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { Payment, PaymentSchema } from '../../schemas/payment.schema';
import { PaystackModule } from '../paystack/paystack.module';
import { FlutterwaveModule } from '../flutterwave/flutterwave.module';
import { CouponModule } from '../coupon/coupon.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
    forwardRef(() => PaystackModule),
    forwardRef(() => FlutterwaveModule),
    CouponModule,
    forwardRef(() => SubscriptionModule),
  ],
  controllers: [PaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
