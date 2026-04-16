import { Module, forwardRef } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { ChurchModule } from '../church/church.module';
import { MembersModule } from '../members/members.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    forwardRef(() => ChurchModule),
    MembersModule,
    SubscriptionModule,
    AttendanceModule,
    PaymentModule,
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
