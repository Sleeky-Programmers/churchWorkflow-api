import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import * as CryptoJS from 'crypto-js';
import { lastValueFrom } from 'rxjs';
import { PaymentService } from '../payment/payment.service';
import {
  BillingCycle,
  PlanType,
  PaymentStatus,
} from '../../common/utils/enums.utils';
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
    churchId: string;
    plan: string;
    billingCycle: BillingCycle;
    metadata?: any;
  }) {
    try {
      const payload = {
        email: data.email,
        amount: data.amount * 100,
        metadata: {
          churchId: data.churchId,
          plan: data.plan,
          billingCycle: data.billingCycle,
          ...data.metadata,
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
        churchId: data.churchId as any,
        reference,
        amount: data.amount,
        plan: data.plan,
        billingCycle: data.billingCycle,
        status: PaymentStatus.PENDING,
        paymentGateway: 'paystack',
        metadata: payload.metadata,
      });

      return { reference, authorization_url };
    } catch (error) {
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
        const { churchId, plan, billingCycle } = data.metadata;

        await this.paymentService.updatePaymentStatus(
          reference,
          PaymentStatus.SUCCESS,
          paidAt,
        );

        await this.subscriptionService.updateSubscription({
          churchId,
          plan: plan as PlanType,
          billingCycle: billingCycle as BillingCycle,
        });

        return data;
      } else {
        await this.paymentService.updatePaymentStatus(
          reference,
          PaymentStatus.FAILED,
        );
        return data;
      }
    } catch (error) {
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

          await this.subscriptionService.updateSubscription({
            churchId: metadata.churchId,
            plan: metadata.plan as PlanType,
            billingCycle: metadata.billingCycle as BillingCycle,
          });
        }
        break;
      }
      case 'charge.failed':
        await this.paymentService.updatePaymentStatus(
          data.reference,
          PaymentStatus.FAILED,
        );
        break;
    }
    return { status: 'success' };
  }
}
