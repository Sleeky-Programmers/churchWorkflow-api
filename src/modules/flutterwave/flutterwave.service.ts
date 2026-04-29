import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { PaymentService } from '../payment/payment.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { CouponService } from '../coupon/coupon.service';
import {
  PaymentStatus,
  PlanType,
  BillingCycle,
  PaymentProvider,
} from '../../common/utils/enums.utils';
import { Types } from 'mongoose';
import { AdminActivityLogService } from '../admin-activity-log/admin-activity-log.service';

@Injectable()
export class FlutterwaveService {
  private readonly secretKey: string;
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

      const payload: any = {
        tx_ref,
        amount: data.amount,
        currency: 'NGN',
        redirect_url:
          this.configService.get<string>('flutterwave.redirectUrl') || '',
        customer: {
          email: data.email,
        },
        meta: {
          churchId: data.churchId,
          plan: data.plan,
          billingCycle: data.billingCycle,
          ...(data.metadata || {}),
          autoRenew: data.autoRenew,
        },
      };

      const response = await lastValueFrom(
        this.httpService.post(`${this.baseUrl}/payments`, payload, {
          headers: this.headers,
        }),
      );

      const respData = response.data.data;

      await this.subscriptionService.getSubscription(
        new Types.ObjectId(data.churchId),
      );

      await this.paymentService.createPayment({
        churchId: data.churchId as any,
        reference: tx_ref,
        transactionId: `TXN_CW_${Date.now()}`,
        autoRenew: payload.meta.autoRenew || false,
        amount: data.amount,
        plan: data.plan,
        billingCycle: data.billingCycle,
        status: PaymentStatus.PENDING,
        paymentGateway: PaymentProvider.FLUTTERWAVE,
        metadata: payload.meta,
      });

      await this.adminActivityLogService.create({
        action: 'PAYMENT_INITIATED',
        details: `Reference ${tx_ref} for plan ${data.plan}`,
        plan: data.plan as any,
      } as any);

      return {
        reference: tx_ref,
        authorization_url:
          respData.link || respData.checkout_url || respData.payment_link,
      };
    } catch (error: any) {
      throw new InternalServerErrorException(
        error.response?.data?.message || 'Flutterwave initialization failed',
      );
    }
  }

  async verifyTransaction(reference: string) {
    try {
      const response = await lastValueFrom(
        this.httpService.get(
          `${this.baseUrl}/transactions/${reference}/verify`,
          {
            headers: this.headers,
          },
        ),
      );

      const data = response.data.data;

      if (data.status === 'successful' || data.status === 'success') {
        const paidAt = new Date(data.created_at || Date.now());
        const meta = data.meta || data.metadata || {};

        await this.paymentService.updatePaymentStatus(
          reference,
          PaymentStatus.SUCCESS,
          paidAt,
          {
            transactionId: data.id || reference,
            paymentMethod: meta.paymentMethod || data.payment_method || null,
            autoRenew: !!meta.autoRenew,
          },
        );

        await this.adminActivityLogService.create({
          action: 'PAYMENT_SUCCESS',
          details: `Reference ${reference} paid for plan ${meta.plan}`,
          plan: meta.plan,
        } as any);

        await this.subscriptionService.updateSubscription({
          churchId: meta.churchId,
          plan: meta.plan as PlanType,
          billingCycle: meta.billingCycle as BillingCycle,
          autoRenew: !!meta.autoRenew,
        });

        const promo = meta.promoCode || meta.promo;
        if (promo) {
          await this.couponService.incrementUsage(promo);
        }

        if (meta && meta.autoRenew) {
          const providerSubId = await this.createFlutterwaveSubscription(
            data,
            meta,
          );
          await this.paymentService.createProviderSubscription(
            reference,
            PaymentProvider.FLUTTERWAVE,
            providerSubId || data.customer?.id || reference,
          );
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
        error.response?.data?.message || 'Flutterwave verification failed',
      );
    }
  }

  async handleWebhook(payload: any) {
    const event = payload.event || payload.type;
    const data = payload.data || payload;

    if (event === 'charge.completed' || data.status === 'successful') {
      const reference = data.tx_ref || data.reference || data.id;
      const meta = data.meta || data.metadata || {};
      if (meta && meta.churchId) {
        await this.paymentService.updatePaymentStatus(
          reference,
          PaymentStatus.SUCCESS,
          new Date(data.created_at || Date.now()),
        );

        await this.adminActivityLogService.create({
          action: 'PAYMENT_SUCCESS',
          details: `Webhook reference ${reference} succeeded for plan ${meta.plan}`,
          plan: meta.plan,
        } as any);

        await this.subscriptionService.updateSubscription({
          churchId: meta.churchId,
          plan: meta.plan as PlanType,
          billingCycle: meta.billingCycle as BillingCycle,
          autoRenew: !!meta.autoRenew,
        });

        if (meta.promoCode) {
          await this.couponService.incrementUsage(meta.promoCode);
        }
      }
    } else if (data.status === 'failed') {
      await this.paymentService.updatePaymentStatus(
        data.tx_ref || data.reference,
        PaymentStatus.FAILED,
      );
    }

    return { status: 'success' };
  }

  private async createFlutterwaveSubscription(
    data: any,
    meta: any,
  ): Promise<string | null> {
    try {
      const body: any = {
        tx_ref: data.tx_ref || data.reference || `CW_SUB_${Date.now()}`,
        amount: data.amount || meta.amount || 0,
        currency: 'NGN',
        customer: {
          email: data.customer?.email || meta.email,
        },
      };

      const url = `${this.baseUrl}/subscriptions`;
      const response = await lastValueFrom(
        this.httpService.post(url, body, {
          headers: this.headers,
        }),
      );

      return (
        response.data.data.id || response.data.data.subscription_id || null
      );
    } catch (err) {
      return null;
    }
  }
}
