import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import {
  DiscountType,
  PaymentProvider,
  PaymentTimeframe,
  PlanType,
  SubscriptionStatus,
} from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CouponService } from '../coupon/coupon.service';
import { FlutterwaveService } from '../flutterwave/flutterwave.service';
import { PaystackService } from '../paystack/paystack.service';
import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';
import { SubscriptionService } from '../subscription/subscription.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { PaymentFilterDto } from './dto/payment-filter.dto';
import { PaymentService } from './payment.service';

@Controller('payment')
export class PaymentController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly paystackService: PaystackService,
    private readonly flutterwaveService: FlutterwaveService,
    private readonly couponService: CouponService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('initialize')
  async initialize(
    @AuthUser() authUser: Admin,
    @Body() body: InitializePaymentDto,
  ) {
    const { promoCode, provider } = body as any;

    const existingSub: any = await this.subscriptionService.getSubscription(
      authUser.churchId,
    );

    if (
      existingSub &&
      existingSub.plan !== PlanType.STARTER &&
      existingSub.status === SubscriptionStatus.ACTIVE
    ) {
      throw new BadRequestException('Active paid subscription exists');
    }

    const baseAmount = this.subscriptionService.getPlanAmount(
      body.plan,
      body.billingCycle,
    );

    let finalAmount = baseAmount;
    const metadata: any = {};

    if (promoCode) {
      const used = await this.paymentService.hasUsedCoupon(
        authUser.churchId,
        promoCode,
      );
      if (used) {
        throw new BadRequestException('Coupon already used by this account');
      }

      const coupon: any = await this.couponService.validateCoupon(promoCode);

      let discountAmount = 0;
      if (coupon.discountType === DiscountType.PERCENTAGE) {
        discountAmount = (baseAmount * coupon.discount) / 100;
      } else {
        discountAmount = coupon.discount;
      }

      finalAmount = Math.max(0, baseAmount - discountAmount);
      metadata.promoCode = coupon.code;
      metadata.originalAmount = baseAmount;
      metadata.discountAmount = discountAmount;
    }

    const initPayload = {
      email: authUser.email,
      amount: finalAmount,
      churchId: authUser.churchId,
      plan: body.plan,
      billingCycle: body.billingCycle,
      metadata,
      autoRenew: !!body.autoRenew,
    };

    if (provider === PaymentProvider.PAYSTACK) {
      return await this.paystackService.initializeTransaction(initPayload);
    }

    if (provider === PaymentProvider.FLUTTERWAVE) {
      return await this.flutterwaveService.initializeTransaction(initPayload);
    }

    throw new BadRequestException('Invalid payment provider');
  }

  // Payment.controller.ts
  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async manualVerify(
    @Body() body: { reference: string; provider: any; transactionId?: string },
  ) {
    const { reference, provider, transactionId } = body;

    if (!reference) {
      throw new BadRequestException('Missing payment reference');
    }

    if (provider === PaymentProvider.PAYSTACK) {
      return await this.paystackService.verifyTransaction(reference);
    }

    if (provider === PaymentProvider.FLUTTERWAVE) {
      const idToVerify = transactionId || reference;
      return await this.flutterwaveService.verifyTransaction(idToVerify);
    }

    throw new BadRequestException('Invalid payment provider');
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Get()
  async list(@Query() paymentFilterDto?: PaymentFilterDto) {
    return await this.paymentService.listPayments(paymentFilterDto);
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Get('stats')
  async stats(@Query('timeframe') timeframe?: PaymentTimeframe) {
    return await this.paymentService.getStats({ timeframe: timeframe || null });
  }
}
