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
  private readonly redirectUrl: string;

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
    this.redirectUrl =
      this.configService.get<string>('flutterwave.redirectUrl') || '';

    if (!this.secretKey) {
      this.logger.warn('Flutterwave secret key not configured');
    }
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
        redirect_url: this.redirectUrl,
        card_tokenize: 1,
        customer: {
          email: data.email,
        },
        customizations: {
          title: 'Subscription Payment',
          description: `${data.plan} plan subscription`,
        },
        meta: {
          churchId: data.churchId.toString(),
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

      const paymentLink = response.data.data.link;

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

      this.logger.log(`Flutterwave payment initialized: ${tx_ref}`);

      return {
        reference: tx_ref,
        authorization_url: paymentLink,
      };
    } catch (error: any) {
      this.logger.error('Flutterwave initialization failed:', error.message);
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Failed to initialize payment',
      );
    }
  }

  // Flutterwave.service.ts
  async verifyTransaction(identifier: string) {
    try {
      this.logger.log(`Verifying Flutterwave transaction: ${identifier}`);

      // Try to find payment by reference first
      let payment = await this.paymentService.findByReference(identifier);

      // If not found by reference, try to find by transactionId (Flutterwave ID)
      if (!payment) {
        payment = await this.paymentService.findByTransactionId(identifier);
      }

      if (!payment) {
        this.logger.error(
          `Payment record not found for identifier: ${identifier}`,
        );
        throw new UnauthorizedException('Payment record not found');
      }

      const isFlutterwaveId = /^\d+$/.test(identifier);
      let verifyId: string;

      if (isFlutterwaveId) {
        verifyId = identifier;
      } else if (payment.transactionId && /^\d+$/.test(payment.transactionId)) {
        verifyId = payment.transactionId;
      } else {
        this.logger.warn(
          `No valid Flutterwave transaction ID found. Using identifier: ${identifier}`,
        );
        verifyId = identifier;
      }

      this.logger.log(`Verifying with Flutterwave ID: ${verifyId}`);

      const response = await lastValueFrom(
        this.httpService.get(
          `${this.baseUrl}/transactions/${verifyId}/verify`,
          {
            headers: this.headers,
          },
        ),
      );

      const data = response.data.data;
      this.logger.log(
        `Flutterwave verification response status: ${data.status}`,
      );

      if (data.status !== FlPaymentStatus.SUCCESS) {
        this.logger.warn(`Payment not successful: ${data.status}`);
        throw new UnauthorizedException('Payment not successful');
      }

      const reference = payment.reference;

      const meta = payment.metadata || {};
      const paymentType = data.payment_type || 'card';
      const reusableToken = data.card?.token || data.card_token;

      const canAutoRenew = paymentType === 'card' && !!reusableToken;

      // Update payment status with Flutterwave's actual transaction ID
      await this.paymentService.updatePaymentStatus(
        reference,
        PaymentStatus.SUCCESS,
        new Date(data.created_at || Date.now()),
        {
          transactionId: String(data.id), // Store Flutterwave's actual transaction ID
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
        providerData: {
          transactionId: String(data.id),
          paymentType: paymentType,
          ...(canAutoRenew && { token: reusableToken }),
        },
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
          this.logger.error('Failed to update coupon usage:', error);
          // Continue even if coupon update fails
        }
      }

      await this.adminActivityLogService.create({
        adminId: null,
        action: 'Payment Successful',
        details: `Reference ${reference} successful via Flutterwave`,
        plan: meta.plan,
      } as any);

      this.logger.log(`Payment ${reference} verified successfully`);

      return {
        status: 'success',
        reference: reference,
        amount: data.amount,
        metadata: meta,
        paymentType: paymentType,
        autoRenew: canAutoRenew,
        flutterwaveTransactionId: String(data.id),
      };
    } catch (error: any) {
      this.logger.error(
        `Flutterwave verification failed for ${identifier}:`,
        error.message,
      );
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Verification failed',
      );
    }
  }

  async handleWebhook(payload: any, signature: string) {
    // Verify webhook signature
    if (!signature || signature !== this.secretHash) {
      this.logger.warn('Invalid webhook signature');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (payload.status !== FlPaymentStatus.SUCCESS) {
      this.logger.log(`Webhook ignored: status ${payload.status}`);
      return { status: FlPaymentStatus.IGNORED };
    }

    const reference = payload.txRef;

    const payment = await this.paymentService.findByReference(reference);

    if (!payment) {
      this.logger.warn(`Payment not found for webhook: ${reference}`);
      return { status: FlPaymentStatus.PAYMENT_NOT_FOUND };
    }

    if (payment.status === PaymentStatus.SUCCESS) {
      this.logger.log(`Payment already processed: ${reference}`);
      return { status: FlPaymentStatus.ALREADY_PROCESSED };
    }

    // Process the successful payment
    const updatedPayment = await this.paymentService.updatePaymentStatus(
      reference,
      PaymentStatus.SUCCESS,
      new Date(payload.createdAt || Date.now()),
      {
        transactionId: String(payload.id || payment.transactionId),
        paymentMethod: payload.payment_type || 'card',
        autoRenew: payload.payment_type === 'card' && !!payload.card?.token,
      },
    );

    await this.subscriptionService.updateSubscription({
      churchId: updatedPayment.metadata.churchId,
      plan: updatedPayment.metadata.plan as PlanType,
      billingCycle: updatedPayment.metadata.billingCycle as BillingCycle,
      autoRenew: !!updatedPayment.metadata.autoRenew,
    });

    return { status: FlPaymentStatus.SUCCESS };
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
