import * as CryptoJS from 'crypto-js';
import { Types } from 'mongoose';
import { lastValueFrom } from 'rxjs';

import { HttpService } from '@nestjs/axios';
import {
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  BillingCycle,
  PaymentProvider,
  PaymentStatus,
  PlanType,
} from '../../common/utils/enums.utils';
import { AdminActivityLogService } from '../admin-activity-log/admin-activity-log.service';
import { CouponService } from '../coupon/coupon.service';
import { OnlineGivingService } from '../online-giving/online-giving.service';
import { PaystackWebhookRegistry } from './paystack-webhook.registry';
import { PaymentService } from '../payment/payment.service';
import { SubscriptionPlanCodesService } from '../subscription-plan-codes/subscription-plan-codes.service';
import { SubscriptionService } from '../subscription/subscription.service';

@Injectable()
export class PaystackService {
  private readonly secretKey: string;
  private readonly baseUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly paymentService: PaymentService,
    private readonly subscriptionService: SubscriptionService,
    private readonly couponService: CouponService,
    private readonly subscriptionPlanCodesService: SubscriptionPlanCodesService,
    private adminActivityLogService: AdminActivityLogService,
    @Inject(
      forwardRef(() => {
        return OnlineGivingService;
      }),
    )
    private readonly onlineGivingService: OnlineGivingService,
    private readonly webhookRegistry: PaystackWebhookRegistry,
  ) {
    this.secretKey = this.configService.get<string>('paystack.secretKey');
    this.baseUrl = this.configService.get<string>('paystack.baseUrl');
  }

  // Separate from initializeTransaction (which is billing/subscription
  // Specific: it creates a Payment record and assumes a plan/billingCycle).
  // This reuses only the raw Paystack HTTP call pattern for one-off,
  // Non-subscription online giving donations.
  async initializeGivingTransaction(data: {
    email?: string;
    amount: number;
    currencyCode: string;
    metadata: Record<string, any>;
  }) {
    try {
      const payload = {
        email: data.email || 'donor@giving.church',
        amount: data.amount * 100,
        currency: data.currencyCode,
        callback_url:
          this.configService.get<string>('giving.redirectUrl') || '',
        metadata: data.metadata,
      };

      const response = await lastValueFrom(
        this.httpService.post(
          `${this.baseUrl}/transaction/initialize`,
          payload,
          { headers: this.headers },
        ),
      );

      const { reference, authorization_url } = response.data.data;

      return { reference, authorizationUrl: authorization_url };
    } catch (error: any) {
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Paystack initialization failed',
      );
    }
  }

  verifyWebhookSignature(payload: any, signature: string): boolean {
    const hash = CryptoJS.HmacSHA512(
      JSON.stringify(payload),
      this.secretKey,
    ).toString(CryptoJS.enc.Hex);
    return hash === signature;
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
      const payload = {
        email: data.email,
        amount: data.amount * 100,
        callback_url:
          this.configService.get<string>('flutterwave.redirectUrl') || '',
        metadata: {
          churchId: data.churchId,
          plan: data.plan,
          billingCycle: data.billingCycle,
          ...data.metadata,
          autoRenew: data.autoRenew,
        },
      };

      const response = await lastValueFrom(
        this.httpService.post(
          `${this.baseUrl}/transaction/initialize`,
          payload,
          {
            headers: this.headers,
          },
        ),
      );
      const { reference, authorization_url } = response.data.data;

      await this.subscriptionService.getSubscription(data.churchId);

      await this.paymentService.createPayment({
        churchId: data.churchId,
        reference,
        transactionId: `TXN_CW_${Date.now()}`,
        autoRenew: payload.metadata.autoRenew || false,
        amount: data.amount,
        plan: data.plan,
        billingCycle: data.billingCycle,
        status: PaymentStatus.PENDING,
        paymentGateway: PaymentProvider.PAYSTACK,
        metadata: payload.metadata,
      });

      await this.adminActivityLogService.create({
        action: 'Payment initiated',
        details: `Reference ${reference} for plan ${data.plan}`,
        plan: data.plan as any,
      } as any);

      return { reference, authorization_url };
    } catch (error: any) {
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Paystack initialization failed',
      );
    }
  }

  async verifyTransaction(reference: string) {
    try {
      const response = await lastValueFrom(
        this.httpService.get(
          `${this.baseUrl}/transaction/verify/${reference}`,
          {
            headers: this.headers,
          },
        ),
      );

      const data = response.data.data;

      if (data.status === 'success') {
        const paidAt = new Date(data.paid_at);
        const { churchId, plan, billingCycle, autoRenew, paymentMethod } =
          data.metadata;

        await this.paymentService.updatePaymentStatus(
          reference,
          PaymentStatus.SUCCESS,
          paidAt,
          {
            transactionId: data.id || reference,
            paymentMethod: paymentMethod || data.channel || null,
            autoRenew: !!autoRenew,
          },
        );

        await this.adminActivityLogService.create({
          adminId: null, // System action
          action: 'Payment success',
          details: `Reference ${reference} paid for plan ${plan}`,
          plan: plan as any,
        } as any);

        let providerData = undefined;

        if (autoRenew) {
          const subscription = await this.createPaystackSubscription(data);

          providerData = {
            subscriptionCode: subscription?.subscription_code,
            emailToken: subscription?.email_token,
            customerCode: data.customer?.customer_code,
          };
        }

        const subscription = await this.subscriptionService.updateSubscription({
          churchId,
          plan: plan as PlanType,
          billingCycle: billingCycle as BillingCycle,
          autoRenew: !!autoRenew,
          providerData,
        });

        // Update coupon usage if promo code was applied
        if (data.metadata && data.metadata.promoCode) {
          try {
            const originalAmount =
              data.metadata.originalAmount || data.amount || 0;
            const discountedAmount = data.amount || 0;

            await this.couponService.incrementUsage(data.metadata.promoCode, {
              churchId: new Types.ObjectId(churchId),
              subscriptionId: subscription._id,
              planType: plan,
              originalAmount: originalAmount,
              discountedAmount: discountedAmount,
            });
          } catch (error) {
            throw error;
          }
        }

        return data;
      } else {
        await this.paymentService.updatePaymentStatus(
          reference,
          PaymentStatus.FAILED,
        );

        await this.adminActivityLogService.create({
          adminId: null, // System action
          action: 'Payment Failed',
          details: `Reference ${reference} failed`,
        } as any);

        return data;
      }
    } catch (error: any) {
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Paystack verification failed',
      );
    }
  }

  async handleWebhook(payload: any) {
    const event = payload.event;
    const data = payload.data;

    // Other products' events (e.g. Service Timer renewals) are theirs.
    if (await this.webhookRegistry.dispatch(payload)) {
      return { status: 'success' };
    }

    switch (event) {
      case 'charge.success': {
        const { reference, metadata, paid_at } = data;

        if (metadata && metadata.type === 'online_giving') {
          await this.onlineGivingService.fulfillFromWebhook(
            metadata,
            reference,
          );
          break;
        }

        // Service Timer plan payments are confirmed by the timer's billing
        // (service-timer/billing), not as Church Workflow subscriptions.
        if (metadata && metadata.type === 'service_timer_plan') {
          break;
        }

        if (metadata && metadata.churchId) {
          await this.paymentService.updatePaymentStatus(
            reference,
            PaymentStatus.SUCCESS,
            new Date(paid_at),
          );

          await this.adminActivityLogService.create({
            adminId: null, // System action
            action: 'Payment Success',
            details: `Webhook reference ${reference} succeeded for plan ${metadata.plan}`,
            plan: metadata.plan,
          } as any);

          const subscription =
            await this.subscriptionService.updateSubscription({
              churchId: metadata.churchId,
              plan: metadata.plan as PlanType,
              billingCycle: metadata.billingCycle as BillingCycle,
              autoRenew: !!metadata.autoRenew,
            });

          // Update coupon usage if promo code was applied
          if (metadata.promoCode) {
            try {
              const originalAmount =
                metadata.originalAmount || metadata.amount || 0;
              const discountedAmount = metadata.amount || 0;

              await this.couponService.incrementUsage(metadata.promoCode, {
                churchId: new Types.ObjectId(metadata.churchId),
                subscriptionId: subscription._id,
                planType: metadata.plan,
                originalAmount: originalAmount,
                discountedAmount: discountedAmount,
              });
            } catch (error) {
              throw error;
            }
          }

          if (metadata && metadata.autoRenew) {
            const providerSubId = await this.createPaystackSubscription(data);
            await this.paymentService.createProviderSubscription(
              reference,
              PaymentProvider.PAYSTACK,
              providerSubId ||
                data.authorization?.authorization_code ||
                data.customer?.customer_code ||
                reference,
            );
          }
        }
        break;
      }

      case 'charge.failed': {
        await this.paymentService.updatePaymentStatus(
          data.reference,
          PaymentStatus.FAILED,
        );

        await this.adminActivityLogService.create({
          adminId: null, // System action
          action: 'Payment failed',
          details: `Webhook reference ${data.reference} failed`,
        } as any);

        break;
      }

      case 'subscription.create': {
        const paymentRecord =
          await this.paymentService.findByProviderSubscriptionCode(
            data.subscription_code,
          );

        await this.subscriptionService.updateSubscription({
          churchId: paymentRecord.metadata.churchId,
          plan: paymentRecord.metadata?.plan,
          billingCycle: paymentRecord.metadata?.billingCycle,
          autoRenew: paymentRecord.metadata?.autoRenew,
          providerData: {
            subscriptionCode: data.subscription_code,
            emailToken: data.email_token,
            customerCode: data.customer,
          },
        });

        break;
      }

      case 'subscription.disable': {
        const subscription = data.subscription || data;
        const subCode =
          subscription.subscription_code || subscription.id || null;
        if (subCode) {
          await this.paymentService.markProviderSubscriptionCanceled(subCode);
        }
        break;
      }

      // Add subscription renewal webhook handling
      case 'subscription.renewal': {
        const { subscription_code, amount } = data;
        const paymentRecord =
          await this.paymentService.findByProviderSubscriptionCode(
            subscription_code,
          );

        if (paymentRecord) {
          // Update subscription with new renewal info
          await this.subscriptionService.updateSubscription({
            churchId: paymentRecord.metadata.churchId,
            plan: paymentRecord.metadata?.plan,
            billingCycle: paymentRecord.metadata?.billingCycle,
            autoRenew: true,
            providerData: {
              subscriptionCode: subscription_code,
            },
          });

          await this.adminActivityLogService.create({
            adminId: null,
            action: 'Subscription Renewed',
            details: `Subscription ${subscription_code} renewed for ${amount}`,
            plan: paymentRecord.metadata?.plan,
          } as any);
        }
        break;
      }

      // Add subscription cancellation webhook handling
      case 'subscription.not_renew': {
        const { subscription_code } = data;
        const paymentRecord =
          await this.paymentService.findByProviderSubscriptionCode(
            subscription_code,
          );

        if (paymentRecord) {
          await this.subscriptionService.updateSubscription({
            churchId: paymentRecord.metadata.churchId,
            plan: paymentRecord.metadata?.plan,
            billingCycle: paymentRecord.metadata?.billingCycle,
            autoRenew: false,
            providerData: {
              subscriptionCode: subscription_code,
            },
          });

          await this.adminActivityLogService.create({
            adminId: null,
            action: 'Subscription Not Renewed',
            details: `Subscription ${subscription_code} will not renew`,
            plan: paymentRecord.metadata?.plan,
          } as any);
        }
        break;
      }
    }

    return { status: 'success' };
  }

  private async createPaystackPlanCode(
    plan: PlanType,
    billingCycle: BillingCycle,
  ) {
    const response = await lastValueFrom(
      this.httpService.post(
        `${this.baseUrl}/plan`,
        {
          name: plan,
          interval:
            billingCycle === BillingCycle.MONTHLY ? 'monthly' : 'annually',
          amount:
            this.subscriptionService.getPlanAmount(plan, billingCycle) * 100,
        },
        {
          headers: this.headers,
        },
      ),
    );

    return response.data.data.plan_code;
  }

  private async createPaystackSubscription(data: any): Promise<any> {
    try {
      let planCodeData: any = null;

      planCodeData = await this.subscriptionPlanCodesService.findPlanCode(
        data.metadata.plan,
        data.metadata.billingCycle,
      );

      if (!planCodeData) {
        const planCode = await this.createPaystackPlanCode(
          data.metadata.plan,
          data.metadata.billingCycle,
        );

        planCodeData = await this.subscriptionPlanCodesService.createPlanCode(
          data.metadata.plan,
          data.metadata.billingCycle,
          planCode,
        );
      }

      const response = await lastValueFrom(
        this.httpService.post(
          `${this.baseUrl}/subscription`,
          {
            customer: data.customer?.customer_code,
            authorization: data.authorization?.authorization_code,
            plan: planCodeData.planCode,
          },
          {
            headers: this.headers,
          },
        ),
      );

      return response.data.data;
    } catch (err) {
      return null;
    }
  }

  async cancelSubscriptionByCode(code: string, token: string) {
    try {
      const body = { code, token };
      const response = await lastValueFrom(
        this.httpService.post(`${this.baseUrl}/subscription/disable`, body, {
          headers: this.headers,
        }),
      );
      await this.paymentService.markProviderSubscriptionCanceled(code);
      return response.data;
    } catch (err: any) {
      throw new InternalServerErrorException(
        err.response?.data?.message || 'Paystack cancel subscription failed',
      );
    }
  }
}
