import { Injectable } from '@nestjs/common';

/**
 * Returns true when the event was the handler's own (it has been dealt with
 * and Church Workflow's handling should be skipped).
 */
export type PaystackWebhookHandler = (payload: {
  event: string;
  data: any;
}) => Promise<boolean>;

/**
 * Lets other products (the Service Timer) handle their own events from the
 * one Paystack webhook, without PaystackService depending on them. Each
 * registered handler gets the event first; the first to claim it wins.
 */
@Injectable()
export class PaystackWebhookRegistry {
  private readonly handlers: PaystackWebhookHandler[] = [];

  register(handler: PaystackWebhookHandler) {
    this.handlers.push(handler);
  }

  async dispatch(payload: { event: string; data: any }) {
    for (const handler of this.handlers) {
      if (await handler(payload)) {
        return true;
      }
    }
    return false;
  }
}
