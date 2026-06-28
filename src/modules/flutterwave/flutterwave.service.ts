import { Types } from 'mongoose';
import { lastValueFrom } from 'rxjs';

import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  BillingCycle,
  FlPaymentStatus,
  PaymentProvider,
  PaymentStatus,
  PlanType,
} from '../../common/utils/enums.utils';
import { AdminActivityLogService } from '../admin-activity-log/admin-activity-log.service';
import { CouponService } from '../coupon/coupon.service';
import { PaymentService } from '../payment/payment.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class FlutterwaveService {
  private readonly logger = new Logger(FlutterwaveService.name);

  private readonly secretKey: string;
  private readonly secretHash: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly paymentService: PaymentService,
    private readonly subscriptionService: SubscriptionService,
    private readonly couponService: CouponService,
    private readonly adminActivityLogService: AdminActivityLogService,
  ) {
    this.secretKey = this.configService.get<string>('flutterwave.secretKey');
    this.secretHash = this.configService.get<string>('flutterwave.secretHash');
    this.baseUrl = this.configService.get<string>('flutterwave.baseUrl');
  }

  private get headers() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  async initializeTransaction(data: {
    email: string;
    amount: number;
    churchId: Types.ObjectId;
    plan: string;
    billingCycle: BillingCycle;
    metadata?: any;
    autoRenew?: boolean;
  }) {
    try {
      const tx_ref = `CW-${Date.now()}`;

      const payload = {
        tx_ref,
        amount: data.amount,
        currency: 'NGN',
        redirect_url:
          this.configService.get<string>('flutterwave.redirectUrl') || '',
        card_tokenize: 1,
        customer: {
          email: data.email,
        },
        customizations: {
          title: 'Subscription Payment',
        },
        meta: {
          churchId: data.churchId,
          plan: data.plan,
          billingCycle: data.billingCycle,
          autoRenew: data.autoRenew,
          ...(data.metadata || {}),
        },
      };

      const response = await lastValueFrom(
        this.httpService.post(`${this.baseUrl}/payments`, payload, {
          headers: this.headers,
        }),
      );

      await this.paymentService.createPayment({
        churchId: data.churchId as any,
        amount: data.amount,
        plan: data.plan,
        billingCycle: data.billingCycle,
        autoRenew: !!data.autoRenew,
        reference: tx_ref,
        transactionId: `TXN_${Date.now()}`,
        status: PaymentStatus.PENDING,
        paymentGateway: PaymentProvider.FLUTTERWAVE,
        metadata: payload.meta,
      });

      return {
        reference: tx_ref,
        authorization_url: response.data.data.link,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to initialize payment',
      );
    }
  }

  async verifyTransaction(transactionId: string) {
    try {
      const response = await lastValueFrom(
        this.httpService.get(
          `${this.baseUrl}/transactions/${transactionId}/verify`,
          {
            headers: this.headers,
          },
        ),
      );

      const data = response.data.data;

      if (data.status !== FlPaymentStatus.SUCCESS) {
        throw new UnauthorizedException('Payment not successful');
      }

      const reference = data.tx_ref;

      const payment = await this.paymentService.findByReference(reference);

      if (!payment) {
        throw new UnauthorizedException('Payment record not found');
      }

      const meta = payment.metadata || {};

      const paymentType = data.payment_type;

      const reusableToken = data.card?.token;

      const canAutoRenew = paymentType === 'card' && !!reusableToken;

      await this.paymentService.updatePaymentStatus(
        reference,
        PaymentStatus.SUCCESS,
        new Date(),
        {
          transactionId: String(data.id),
          paymentMethod: paymentType,
          autoRenew: canAutoRenew,
        },
      );

      if (canAutoRenew) {
        await this.paymentService.createProviderSubscription(
          reference,
          PaymentProvider.FLUTTERWAVE,
          reusableToken,
        );
      }

      const subscription = await this.subscriptionService.updateSubscription({
        churchId: meta.churchId,
        plan: meta.plan as PlanType,
        billingCycle: meta.billingCycle as BillingCycle,
        autoRenew: canAutoRenew,
      });

      // Update coupon usage if promo code was applied
      if (meta.promoCode) {
        try {
          const originalAmount = meta.originalAmount || meta.amount || 0;
          const discountedAmount = meta.discountedAmount || meta.amount || 0;

          await this.couponService.incrementUsage(meta.promoCode, {
            churchId: new Types.ObjectId(meta.churchId),
            subscriptionId: subscription._id,
            planType: meta.plan,
            originalAmount: originalAmount,
            discountedAmount: discountedAmount,
          });
        } catch (error) {
          throw error;
        }
      }

      await this.adminActivityLogService.create({
        adminId: null, // System action
        action: 'Payment Successful',
        details: `Reference ${reference} successful`,
        plan: meta.plan,
      } as any);

      return {
        success: true,
        autoRenew: canAutoRenew,
        paymentType,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Verification failed',
      );
    }
  }

  async handleWebhook(payload: any, signature: string) {
    if (!signature || signature !== this.secretHash) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (payload.status !== FlPaymentStatus.SUCCESS) {
      return {
        status: FlPaymentStatus.IGNORED,
      };
    }

    const reference = payload.txRef;

    const payment = await this.paymentService.findByReference(reference);

    if (!payment) {
      return {
        status: FlPaymentStatus.PAYMENT_NOT_FOUND,
      };
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      return {
        status: FlPaymentStatus.ALREADY_PROCESSED,
      };
    }

    const updatedPayment = await this.paymentService.updatePaymentStatus(
      reference,
      PaymentStatus.SUCCESS,
      new Date(payload.createdAt || Date.now()),
    );

    await this.subscriptionService.updateSubscription({
      churchId: updatedPayment.metadata.churchId,
      plan: updatedPayment.metadata.plan as PlanType,
      billingCycle: updatedPayment.metadata.billingCycle as BillingCycle,
      autoRenew: !!updatedPayment.metadata.autoRenew,
    });

    return {
      status: FlPaymentStatus.SUCCESS,
    };
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async processRecurringSubscriptions() {
    this.logger.log('Processing recurring subscriptions...');

    const dueSubscriptions =
      await this.subscriptionService.getDueSubscriptions();

    for (const subscription of dueSubscriptions) {
      try {
        if (!subscription.isAutoRenew) {
          continue;
        }

        if (!subscription.provider?.subscriptionId) {
          continue;
        }

        await this.chargeTokenizedCard(subscription);
      } catch (error) {
        this.logger.error(`Failed recurring charge for ${subscription._id}`);
      }
    }
  }

  async chargeTokenizedCard(subscription: any) {
    try {
      const tx_ref = `RENEW_${Date.now()}`;

      const payload = {
        token: subscription.providerSubscriptionId,
        currency: 'NGN',
        country: 'NG',
        amount: subscription.amount,
        email: subscription.email,
        tx_ref,
      };

      const response = await lastValueFrom(
        this.httpService.post(`${this.baseUrl}/tokenized-charges`, payload, {
          headers: this.headers,
        }),
      );

      const data = response.data.data;

      await this.paymentService.createPayment({
        churchId: subscription.churchId,
        amount: subscription.amount,
        reference: tx_ref,
        transactionId: String(data.id),
        autoRenew: true,
        plan: subscription.plan,
        billingCycle: subscription.billingCycle,
        status:
          data.status === FlPaymentStatus.SUCCESS
            ? PaymentStatus.SUCCESS
            : PaymentStatus.PENDING,
        paymentGateway: PaymentProvider.FLUTTERWAVE,
        metadata: {
          recurring: true,
        },
      });

      if (data.status === FlPaymentStatus.SUCCESS) {
        await this.subscriptionService.extendSubscription({
          churchId: subscription.churchId,
          billingCycle: subscription.billingCycle,
        });

        await this.adminActivityLogService.create({
          action: 'Recurring Charge Success',
          details: `Subscription renewed automatically`,
          plan: subscription.plan,
        } as any);
      }

      return data;
    } catch (error: any) {
      this.logger.error(error.response?.data || error.message);

      throw error;
    }
  }
}
