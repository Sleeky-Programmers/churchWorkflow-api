import {
  Controller,
  Get,
  Post,
  Body,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaystackService } from '../paystack/paystack.service';
import { FlutterwaveService } from '../flutterwave/flutterwave.service';
import { CouponService } from '../coupon/coupon.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import {
  DiscountType,
  PaymentProvider,
  PaymentTimeframe,
  PlanType,
  SubscriptionStatus,
} from '../../common/utils/enums.utils';
import { PaymentStatus } from '../../common/utils/enums.utils';
import { SubscriptionService } from '../subscription/subscription.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { Query } from '@nestjs/common';
import { PaymentFilterDto } from './dto/payment-filter.dto';
import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';

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

  @UseGuards(JwtAuthGuard)
  @Post('verify')
  async manualVerify(@Body() body: { reference: string; provider: any }) {
    const { reference, provider } = body as any;

    if (!reference) {
      throw new BadRequestException('Missing payment reference');
    }

    let paymentResult: any;
    if (provider === PaymentProvider.PAYSTACK) {
      paymentResult = await this.paystackService.verifyTransaction(reference);
    } else if (provider === PaymentProvider.FLUTTERWAVE) {
      paymentResult =
        await this.flutterwaveService.verifyTransaction(reference);
    } else {
      throw new BadRequestException('Invalid provider');
    }

    // Const metadata = paymentResult.metadata || {};

    if (paymentResult.status === 'success') {
      await this.paymentService.updatePaymentStatus(
        reference,
        PaymentStatus.SUCCESS,
        new Date(),
      );

      await this.subscriptionService.updateSubscription({
        churchId: paymentResult.churchId,
        plan: paymentResult.plan,
        billingCycle: paymentResult.billingCycle,
        autoRenew: paymentResult.autoRenew,
        providerData: {
          subscriptionCode:
            paymentResult.subscription_code ||
            paymentResult.data?.subscription_code,
          emailToken:
            paymentResult.email_token || paymentResult.data?.email_token,
          customerCode:
            paymentResult.customer?.customer_code ||
            paymentResult.data?.customer?.customer_code,
        },
      });
    }

    return paymentResult;
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
