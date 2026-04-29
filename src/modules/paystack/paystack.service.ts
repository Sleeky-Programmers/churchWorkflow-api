import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import * as CryptoJS from 'crypto-js';
import { lastValueFrom } from 'rxjs';
import { PaymentService } from '../payment/payment.service';
import { CouponService } from '../coupon/coupon.service';
import {
  BillingCycle,
  PlanType,
  PaymentStatus,
  PaymentProvider,
} from '../../common/utils/enums.utils';
import { SubscriptionService } from '../subscription/subscription.service';
import { SubscriptionPlanCodesService } from '../subscription-plan-codes/subscription-plan-codes.service';
import { Types } from 'mongoose';
import { AdminActivityLogService } from '../admin-activity-log/admin-activity-log.service';

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
  ) {
    this.secretKey = this.configService.get<string>('paystack.secretKey');
    this.baseUrl = this.configService.get<string>('paystack.baseUrl');
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
      const hasActiveSub = await this.subscriptionService.isActiveAutoRenewing(
        data.churchId,
      );

      if (hasActiveSub) {
        throw new BadRequestException(
          'You already have an active subscription',
        );
      }

      const payload = {
        email: data.email,
        amount: data.amount * 100,
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
        action: 'PAYMENT_INITIATED',
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
          action: 'PAYMENT_SUCCESS',
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

        await this.subscriptionService.updateSubscription({
          churchId,
          plan: plan as PlanType,
          billingCycle: billingCycle as BillingCycle,
          autoRenew: !!autoRenew,
          providerData,
        });

        if (data.metadata && data.metadata.promoCode) {
          await this.couponService.incrementUsage(data.metadata.promoCode);
        }

        return data;
      } else {
        await this.paymentService.updatePaymentStatus(
          reference,
          PaymentStatus.FAILED,
        );

        await this.adminActivityLogService.create({
          action: 'PAYMENT_FAILED',
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
    switch (event) {
      case 'charge.success': {
        const { reference, metadata, paid_at } = data;

        if (metadata && metadata.churchId) {
          await this.paymentService.updatePaymentStatus(
            reference,
            PaymentStatus.SUCCESS,
            new Date(paid_at),
          );

          await this.adminActivityLogService.create({
            action: 'PAYMENT_SUCCESS',
            details: `Webhook reference ${reference} succeeded for plan ${metadata.plan}`,
            plan: metadata.plan,
          } as any);

          await this.subscriptionService.updateSubscription({
            churchId: metadata.churchId,
            plan: metadata.plan as PlanType,
            billingCycle: metadata.billingCycle as BillingCycle,
            autoRenew: !!metadata.autoRenew,
          });

          if (metadata.promoCode) {
            await this.couponService.incrementUsage(metadata.promoCode);
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
      case 'charge.failed':
        await this.paymentService.updatePaymentStatus(
          data.reference,
          PaymentStatus.FAILED,
        );

        await this.adminActivityLogService.create({
          action: 'PAYMENT_FAILED',
          details: `Webhook reference ${data.reference} failed`,
        } as any);

        break;
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
        data.metadata.billingCycle,
      );

      if (!planCodeData) {
        const planCode = await this.createPaystackPlanCode(
          data.metadata.plan,
          data.metadata.billingCycle,
        );

        planCodeData = await this.subscriptionPlanCodesService.createPlanCode(
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
