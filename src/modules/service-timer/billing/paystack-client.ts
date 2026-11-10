import axios from 'axios';

import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface PaystackTransaction {
  status: string;
  reference: string;
  amount: number;
  paid_at?: string;
  metadata?: Record<string, unknown>;
}

/**
 * The two Paystack calls the timer needs. Kept separate from Church
 * Workflow's PaystackService, which applies Church Workflow plans on verify.
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
}
