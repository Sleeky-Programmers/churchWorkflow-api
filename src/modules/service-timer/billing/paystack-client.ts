import axios from 'axios';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PaystackTransaction {
  status: string;
  reference: string;
  amount: number;
  paid_at?: string;
  metadata?: Record<string, unknown>;
  customer?: { customer_code?: string; email?: string };
  authorization?: { authorization_code?: string; reusable?: boolean };
}

/**
 * The Paystack calls the timer needs. Kept separate from Church Workflow's
 * PaystackService, which applies Church Workflow plans on verify.
 */
@Injectable()
export class TimerPaystackClient {
  constructor(private config: ConfigService) {}

  private get settings() {
    const secret = this.config.get<string>('paystack.secretKey');
    const baseUrl =
      this.config.get<string>('paystack.baseUrl') || 'https://api.paystack.co';
    if (!secret) {
      throw new ServiceUnavailableException(
        "Payments aren't set up on this server yet.",
      );
    }
    return {
      baseUrl: baseUrl.replace(/\/$/, ''),
      headers: { Authorization: `Bearer ${secret}` },
    };
  }

  /** Starts a payment; amount in naira. Returns where to send the payer. */
  async initialize(body: {
    email: string;
    amountNaira: number;
    callbackUrl: string;
    metadata: Record<string, unknown>;
  }): Promise<{ reference: string; authorizationUrl: string }> {
    const { baseUrl, headers } = this.settings;
    const res = await axios.post(
      `${baseUrl}/transaction/initialize`,
      {
        email: body.email,
        amount: Math.round(body.amountNaira * 100),
        currency: 'NGN',
        callback_url: body.callbackUrl,
        metadata: body.metadata,
      },
      { headers, timeout: 20_000 },
    );
    const data = res.data?.data;
    return {
      reference: data.reference,
      authorizationUrl: data.authorization_url,
    };
  }

  async verify(reference: string): Promise<PaystackTransaction> {
    const { baseUrl, headers } = this.settings;
    const res = await axios.get(
      `${baseUrl}/transaction/verify/${encodeURIComponent(reference)}`,
      { headers, timeout: 20_000 },
    );
    return res.data?.data;
  }

  /** A Paystack plan to renew on; amount in naira. Returns its code. */
  async createPlan(body: {
    name: string;
    interval: 'monthly' | 'annually';
    amountNaira: number;
  }): Promise<string> {
    const { baseUrl, headers } = this.settings;
    const res = await axios.post(
      `${baseUrl}/plan`,
      {
        name: body.name,
        interval: body.interval,
        amount: Math.round(body.amountNaira * 100),
        currency: 'NGN',
      },
      { headers, timeout: 20_000 },
    );
    return res.data?.data?.plan_code;
  }

  /**
   * Sets a plan's price; subscriptions already on it renew at the new price
   * (as Church Workflow's own plans do). Amount in naira.
   */
  async updatePlanAmount(code: string, amountNaira: number) {
    const { baseUrl, headers } = this.settings;
    await axios.put(
      `${baseUrl}/plan/${encodeURIComponent(code)}`,
      {
        amount: Math.round(amountNaira * 100),
        update_existing_subscriptions: true,
      },
      { headers, timeout: 20_000 },
    );
  }

  /** Charges the saved card on the plan's interval, first on `startDate`. */
  async createSubscription(body: {
    customer: string;
    authorization: string;
    plan: string;
    startDate: Date;
  }): Promise<{ subscriptionCode: string; emailToken: string }> {
    const { baseUrl, headers } = this.settings;
    const res = await axios.post(
      `${baseUrl}/subscription`,
      {
        customer: body.customer,
        authorization: body.authorization,
        plan: body.plan,
        start_date: body.startDate.toISOString(),
      },
      { headers, timeout: 20_000 },
    );
    const data = res.data?.data ?? {};
    return {
      subscriptionCode: data.subscription_code,
      emailToken: data.email_token,
    };
  }

  async disableSubscription(code: string, token: string) {
    const { baseUrl, headers } = this.settings;
    await axios.post(
      `${baseUrl}/subscription/disable`,
      { code, token },
      { headers, timeout: 20_000 },
    );
  }
}
