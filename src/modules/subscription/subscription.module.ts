import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import {
  Subscription,
  SubscriptionSchema,
} from '../../schemas/subscription.schema';
import { PaymentModule } from '../payment/payment.module';
import { AdminActivityLogModule } from '../admin-activity-log/admin-activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Subscription.name, schema: SubscriptionSchema },
    ]),
    forwardRef(() => PaymentModule),
    AdminActivityLogModule,
  ],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
