import { Types } from 'mongoose';

import { ConflictException } from '@nestjs/common';

import {
  TimerBillingCycle,
  TimerPaymentStatus,
  TimerPlan,
} from '../../../schemas/timer-billing.schema';
import {
  TIMER_PAYMENT_TYPE,
  TimerBillingService,
} from './timer-billing.service';

/** Just enough of a Mongoose model for these tests (equality filters). */
function memModel(unique?: string) {
  const docs: any[] = [];
  const matches = (d: any, q: any) => {
    return Object.entries(q).every(([k, v]) => {
      return String(d[k]) === String(v);
    });
  };
  const query = (result: any): any => {
    return {
      lean: async () => {
        return result;
      },
      sort: () => {
        return query(result);
      },
      then: (ok: any, bad: any) => {
        return Promise.resolve(result).then(ok, bad);
      },
    };
  };
  return {
    docs,
    findOne: (q: any) => {
      return query(
        docs.find((d) => {
          return matches(d, q);
        }) ?? null,
      );
    },
    exists: async (q: any) => {
      return docs.some((d) => {
        return matches(d, q);
      })
        ? {}
        : null;
    },
    create: async (d: any) => {
      if (
        unique &&
        docs.some((x) => {
          return x[unique] === d[unique];
        })
      ) {
        throw Object.assign(new Error('dup'), { code: 11000 });
      }
      const doc = {
        _id: new Types.ObjectId(),
        status: TimerPaymentStatus.PENDING,
        ...d,
      };
      docs.push(doc);
      return doc;
    },
    updateOne: async (q: any, u: any, opts: any = {}) => {
      const d = docs.find((x) => {
        return matches(x, q);
      });
      if (d) {
        Object.assign(d, u.$set);
        return { matchedCount: 1, modifiedCount: 1 };
      }
      if (opts.upsert) {
        docs.push({ _id: new Types.ObjectId(), ...q, ...u.$set });
      }
      return { matchedCount: 0, modifiedCount: 0 };
    },
  };
}

const churchId = new Types.ObjectId();
const admin = { _id: new Types.ObjectId(), churchId, email: 'a@x.com' } as any;

function setup(opts: { planKey?: string } = {}) {
  const payments = memModel('reference');
  const subs = memModel();
  const config: any = {
    name: 'Church',
    monthlyPrice: 2500,
    yearlyPrice: 25000,
    paystackPlans: {},
  };
  const plans = {
    planFor: jest.fn(async () => {
      return { key: opts.planKey ?? 'FREE' };
    }),
    getConfig: async () => {
      return config;
    },
    subscriptionOf: async () => {
      return subs.docs[0] ?? null;
    },
    setPaystackPlan: async (cycle: string, p: any) => {
      config.paystackPlans[cycle] = p;
    },
  };
  const paystack = {
    initialize: jest.fn(async (_body: any) => {
      return {
        reference: 'ref_1',
        authorizationUrl: 'https://checkout.paystack.com/x',
      };
    }),
    verify: jest.fn(async (reference: string): Promise<any> => {
      return {
        status: 'success',
        reference,
        amount: 250000,
        customer: { customer_code: 'CUS_1' },
        authorization: { authorization_code: 'AUTH_1', reusable: true },
      };
    }),
    createPlan: jest.fn(async () => {
      return 'PLN_monthly';
    }),
    createSubscription: jest.fn(async () => {
      return {
        subscriptionCode: 'SUB_1',
        emailToken: 'tok_1',
      };
    }),
    disableSubscription: jest.fn(async () => {
      return undefined;
    }),
  };
  const service = new TimerBillingService(
    payments as any,
    subs as any,
    {} as any,
    {} as any,
    {} as any,
    plans as any,
    paystack as any,
    {} as any,
    {
      register: () => {
        return undefined;
      },
    } as any,
  );
  return { service, payments, subs, paystack, config, plans };
}

async function paidWithAutoRenew(s: ReturnType<typeof setup>) {
  await s.service.checkout(admin, TimerBillingCycle.MONTHLY, 'cb', true);
  await s.service.confirm(churchId, 'ref_1');
}

describe('Timer auto-renew', () => {
  it('puts the card on a Paystack subscription that starts at period end', async () => {
    const s = setup();
    await paidWithAutoRenew(s);

    const sub = s.subs.docs[0];
    expect(s.paystack.initialize.mock.calls[0][0].metadata).toMatchObject({
      type: TIMER_PAYMENT_TYPE,
      autoRenew: true,
    });
    expect(s.paystack.createPlan).toHaveBeenCalledWith({
      name: 'Service Timer Church (monthly)',
      interval: 'monthly',
      amountNaira: 2500,
    });
    expect(s.paystack.createSubscription).toHaveBeenCalledWith({
      customer: 'CUS_1',
      authorization: 'AUTH_1',
      plan: 'PLN_monthly',
      startDate: sub.currentPeriodEnd,
    });
    expect(sub).toMatchObject({
      autoRenew: true,
      paystackCustomerCode: 'CUS_1',
      paystackPlanCode: 'PLN_monthly',
      paystackSubscriptionCode: 'SUB_1',
      paystackEmailToken: 'tok_1',
    });
    expect(s.config.paystackPlans.monthly).toEqual({
      code: 'PLN_monthly',
      amount: 2500,
    });
  });

  it('reuses the Paystack plan, and makes a new one when the price changes', async () => {
    const s = setup();
    s.config.paystackPlans.monthly = { code: 'PLN_old', amount: 2500 };
    await paidWithAutoRenew(s);
    expect(s.paystack.createPlan).not.toHaveBeenCalled();
    expect(s.subs.docs[0].paystackPlanCode).toBe('PLN_old');

    const t = setup();
    t.config.paystackPlans.monthly = { code: 'PLN_old', amount: 2000 };
    await paidWithAutoRenew(t);
    expect(t.paystack.createPlan).toHaveBeenCalled();
  });

  it("doesn't set up renewals for a card Paystack can't reuse", async () => {
    const s = setup();
    s.paystack.verify.mockResolvedValueOnce({
      status: 'success',
      reference: 'ref_1',
      amount: 250000,
      customer: { customer_code: 'CUS_1' },
      authorization: { authorization_code: 'AUTH_1', reusable: false },
    });
    await paidWithAutoRenew(s);
    expect(s.paystack.createSubscription).not.toHaveBeenCalled();
    expect(s.subs.docs[0].plan).toBe(TimerPlan.CHURCH);
    expect(s.subs.docs[0].autoRenew).toBeFalsy();
  });

  it('extends the plan once per renewal charge', async () => {
    const s = setup();
    await paidWithAutoRenew(s);
    const firstEnd = s.subs.docs[0].currentPeriodEnd as Date;

    const renewal = {
      event: 'charge.success',
      data: {
        reference: 'renew_1',
        amount: 250000,
        paid_at: new Date().toISOString(),
        plan: { plan_code: 'PLN_monthly' },
        customer: { customer_code: 'CUS_1' },
      },
    };
    expect(await s.service.handleWebhook(renewal)).toBe(true);
    expect(await s.service.handleWebhook(renewal)).toBe(true); // Retried

    const end = s.subs.docs[0].currentPeriodEnd as Date;
    const expected = new Date(firstEnd);
    expected.setUTCMonth(expected.getUTCMonth() + 1);
    expect(end.toISOString()).toBe(expected.toISOString());
    const renewals = s.payments.docs.filter((p) => {
      return p.renewal;
    });
    expect(renewals).toHaveLength(1);
    expect(renewals[0]).toMatchObject({
      amount: 2500,
      status: TimerPaymentStatus.SUCCESS,
      adminId: null,
    });
  });

  it('renews the right church when one payer runs two', async () => {
    const s = setup();
    // An older church by the same payer, same plan, auto-renew off.
    const old = {
      _id: new Types.ObjectId(),
      churchId: new Types.ObjectId(),
      cycle: TimerBillingCycle.MONTHLY,
      currentPeriodEnd: new Date('2026-01-01'),
      autoRenew: false,
      paystackCustomerCode: 'CUS_1',
      paystackPlanCode: 'PLN_monthly',
    };
    s.subs.docs.push(old);
    await paidWithAutoRenew(s);
    const mine = s.subs.docs.find((d) => {
      return String(d.churchId) === String(churchId);
    });
    const before = mine.currentPeriodEnd.getTime();

    await s.service.handleWebhook({
      event: 'charge.success',
      data: {
        reference: 'renew_2',
        amount: 250000,
        plan: { plan_code: 'PLN_monthly' },
        customer: { customer_code: 'CUS_1' },
      },
    });
    expect(mine.currentPeriodEnd.getTime()).toBeGreaterThan(before);
    expect(old.currentPeriodEnd.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it("leaves Church Workflow's own events alone", async () => {
    const s = setup();
    await paidWithAutoRenew(s);
    expect(
      await s.service.handleWebhook({
        event: 'charge.success',
        data: {
          reference: 'cw_1',
          metadata: { churchId: 'x', plan: 'PRO' },
          plan: { plan_code: 'PLN_cw' },
          customer: { customer_code: 'CUS_9' },
        },
      }),
    ).toBe(false);
    expect(
      await s.service.handleWebhook({
        event: 'subscription.create',
        data: { subscription_code: 'SUB_cw', plan: { plan_code: 'PLN_cw' } },
      }),
    ).toBe(false);
    expect(
      await s.service.handleWebhook({
        event: 'subscription.disable',
        data: { subscription_code: 'SUB_cw' },
      }),
    ).toBe(false);
  });

  it('applies a checkout from the webhook when the payer never comes back', async () => {
    const s = setup();
    await s.service.checkout(admin, TimerBillingCycle.YEARLY, 'cb');
    s.paystack.verify.mockResolvedValueOnce({
      status: 'success',
      reference: 'ref_1',
      amount: 2_500_000,
    });
    const claimed = await s.service.handleWebhook({
      event: 'charge.success',
      data: { reference: 'ref_1', metadata: { type: TIMER_PAYMENT_TYPE } },
    });
    expect(claimed).toBe(true);
    expect(s.payments.docs[0].status).toBe(TimerPaymentStatus.SUCCESS);
    expect(s.subs.docs[0].cycle).toBe(TimerBillingCycle.YEARLY);
  });

  it('turning it off cancels the Paystack subscription and keeps the paid time', async () => {
    const s = setup();
    await paidWithAutoRenew(s);
    const end = s.subs.docs[0].currentPeriodEnd;
    await s.service.cancelAutoRenew(churchId);
    expect(s.paystack.disableSubscription).toHaveBeenCalledWith(
      'SUB_1',
      'tok_1',
    );
    expect(s.subs.docs[0]).toMatchObject({ autoRenew: false });
    expect(s.subs.docs[0].currentPeriodEnd).toBe(end);

    // Paystack's own disable event afterwards is the timer's.
    expect(
      await s.service.handleWebhook({
        event: 'subscription.disable',
        data: { subscription_code: 'SUB_1' },
      }),
    ).toBe(true);
  });

  it('marks it off when Paystack stops renewing (e.g. the card expired)', async () => {
    const s = setup();
    await paidWithAutoRenew(s);
    await s.service.handleWebhook({
      event: 'subscription.not_renew',
      data: { subscription_code: 'SUB_1' },
    });
    expect(s.subs.docs[0].autoRenew).toBe(false);
  });

  it('cancels a subscription Paystack confirms after auto-renew was turned off', async () => {
    const s = setup();
    s.paystack.createSubscription.mockResolvedValueOnce({
      subscriptionCode: undefined as any,
      emailToken: undefined as any,
    });
    await paidWithAutoRenew(s);
    await s.service.cancelAutoRenew(churchId);
    expect(s.paystack.disableSubscription).not.toHaveBeenCalled();

    await s.service.handleWebhook({
      event: 'subscription.create',
      data: {
        subscription_code: 'SUB_late',
        email_token: 'tok_late',
        plan: { plan_code: 'PLN_monthly' },
        customer: { customer_code: 'CUS_1' },
      },
    });
    expect(s.paystack.disableSubscription).toHaveBeenCalledWith(
      'SUB_late',
      'tok_late',
    );
  });

  it("won't take a second payment while auto-renew is on", async () => {
    const s = setup();
    await paidWithAutoRenew(s);
    s.plans.planFor.mockResolvedValue({ key: TimerPlan.CHURCH } as any);
    await expect(
      s.service.checkout(admin, TimerBillingCycle.YEARLY, 'cb'),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
