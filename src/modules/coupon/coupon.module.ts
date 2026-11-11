import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Coupon, CouponSchema } from '../../schemas/coupon.schema';
import { AdminActivityLogModule } from '../admin-activity-log/admin-activity-log.module';
import { CouponController } from './coupon.controller';
import { CouponService } from './coupon.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Coupon.name, schema: CouponSchema }]),
    forwardRef(() => {
      return AdminActivityLogModule;
    }),
  ],
  controllers: [CouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
