import { Types } from 'mongoose';

import {
  BadRequestException,
  HttpException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { ChurchProduct } from '../../../common/utils/enums.utils';
import {
  TimerBillingCycle,
  TimerPaymentStatus,
  TimerPlan,
} from '../../../schemas/timer-billing.schema';
import { ServiceTimerService } from '../service-timer.service';
import {
  TIMER_PAYMENT_TYPE,
  TimerBillingService,
} from './timer-billing.service';
import {
  COLOUR_PRESETS,
  DEFAULT_PLANS,
  effectivePlanKey,
  extendPeriod,
  isPreset,
} from './timer-plans';

const now = new Date('2026-11-10T12:00:00Z');
const day = 86_400_000;

describe('plan rules', () => {
  it('includes the timer in Church Workflow', () => {
    expect(effectivePlanKey([ChurchProduct.CHURCH_WORKFLOW], null, now)).toBe(
      'CHURCH_WORKFLOW',
    );
    expect(effectivePlanKey(undefined, null, now)).toBe('CHURCH_WORKFLOW');
  });

  it('timer-only churches are Free unless paid up', () => {
    const timer = [ChurchProduct.SERVICE_TIMER];
    expect(effectivePlanKey(timer, null, now)).toBe(TimerPlan.FREE);
    expect(
      effectivePlanKey(timer, { currentPeriodEnd: new Date(+now + day) }, now),
    ).toBe(TimerPlan.CHURCH);
    expect(
      effectivePlanKey(timer, { currentPeriodEnd: new Date(+now - 1) }, now),
    ).toBe(TimerPlan.FREE);
  });

  it('a timer church gets it included while Church Workflow runs for it', () => {
    const timer = [ChurchProduct.SERVICE_TIMER];
    const started = [
      ChurchProduct.SERVICE_TIMER,
      ChurchProduct.CHURCH_WORKFLOW,
    ];
    const trial = {
      status: 'TRIAL',
      endDate: new Date(+now + 3 * day),
      gracePeriodEndDate: new Date(+now + 3 * day),
    };
    // The trial made at sign-up doesn't count until they start it.
    expect(effectivePlanKey(timer, null, now, trial)).toBe(TimerPlan.FREE);
    expect(effectivePlanKey(started, null, now, trial)).toBe('CHURCH_WORKFLOW');
    // Trial over: back to the timer's own plan.
    const ended = {
      status: 'TRIAL',
      endDate: new Date(+now - day),
      gracePeriodEndDate: new Date(+now - day),
    };
    expect(effectivePlanKey(started, null, now, ended)).toBe(TimerPlan.FREE);
    expect(
      effectivePlanKey(
        started,
        { currentPeriodEnd: new Date(+now + day) },
        now,
        ended,
      ),
    ).toBe(TimerPlan.CHURCH);
    // Paid for Church Workflow (even without starting from the timer),
    // Including its 7-day grace after the end date.
    const paid = {
      status: 'ACTIVE',
      endDate: new Date(+now - 2 * day),
      gracePeriodEndDate: null,
    };
    expect(effectivePlanKey(timer, null, now, paid)).toBe('CHURCH_WORKFLOW');
    const lapsed = {
      status: 'ACTIVE',
      endDate: new Date(+now - 8 * day),
      gracePeriodEndDate: null,
    };
    expect(effectivePlanKey(timer, null, now, lapsed)).toBe(TimerPlan.FREE);
  });

  it('leaves churches that came through Church Workflow as they were', () => {
    const expired = { status: 'EXPIRED', endDate: new Date(+now - 30 * day) };
    expect(
      effectivePlanKey([ChurchProduct.CHURCH_WORKFLOW], null, now, expired),
    ).toBe('CHURCH_WORKFLOW');
    expect(effectivePlanKey(undefined, null, now, null)).toBe(
      'CHURCH_WORKFLOW',
    );
  });

  it('paying again extends from the current end, or from now if lapsed', () => {
    const end = new Date('2026-12-05T00:00:00Z');
    expect(
      extendPeriod(end, TimerBillingCycle.MONTHLY, now).toISOString(),
    ).toBe('2027-01-05T00:00:00.000Z');
    expect(
      extendPeriod(null, TimerBillingCycle.YEARLY, now).toISOString(),
    ).toBe('2027-11-10T12:00:00.000Z');
    expect(
      extendPeriod(
        new Date('2026-01-01'),
        TimerBillingCycle.MONTHLY,
        now,
      ).toISOString(),
    ).toBe('2026-12-10T12:00:00.000Z');
  });

  it('matches the Product Plan: Free 2 users / 1 import, Church 5 / 30', () => {
    expect(DEFAULT_PLANS.FREE).toMatchObject({
      userLimit: 2,
      importLimit: 1,
      customBranding: false,
    });
    expect(DEFAULT_PLANS.CHURCH).toMatchObject({
      userLimit: 5,
      importLimit: 30,
      customBranding: true,
    });
    expect(DEFAULT_PLANS.CHURCH.monthlyPrice).toBeGreaterThanOrEqual(2000);
    expect(DEFAULT_PLANS.CHURCH.monthlyPrice).toBeLessThanOrEqual(3000);
  });

  it('recognises colour presets, in any letter case', () => {
    expect(isPreset(COLOUR_PRESETS[1])).toBe(true);
    expect(isPreset({ ...COLOUR_PRESETS[0], bg: '#0C1A4D' })).toBe(true);
    expect(isPreset({ ...COLOUR_PRESETS[0], bg: '#123456' })).toBe(false);
  });
});

const churchId = new Types.ObjectId();
const admin = {
  _id: new Types.ObjectId(),
  churchId,
  email: 'ada@example.com',
} as any;

function billing(
  opts: { planKey?: string; tx?: any; payment?: any; price?: number } = {},
) {
  const payments: any[] = opts.payment ? [opts.payment] : [];
  const subs: any[] = [];
  const paymentModel = {
    create: jest.fn(async (d) => {
      return payments.push({ ...d, status: TimerPaymentStatus.PENDING });
    }),
    findOne: jest.fn(async (q) => {
      return (
        payments.find((p) => {
          return p.reference === q.reference;
        }) ?? null
      );
    }),
    find: () => {
      return {
        limit: async () => {
          return payments.filter((p) => {
            return p.status === TimerPaymentStatus.PENDING;
          });
        },
      };
    },
    updateOne: jest.fn(async (q, u) => {
      const p = payments.find((x) => {
        return x._id === q._id && x.status === q.status;
      });
      if (!p) {
        return { modifiedCount: 0 };
      }
      Object.assign(p, u.$set);
      return { modifiedCount: 1 };
    }),
  };
  const subscriptionModel = {
    findOne: async () => {
      return subs[0] ?? null;
    },
    updateOne: jest.fn(async (_q, u) => {
      if (subs[0]) {
        Object.assign(subs[0], u.$set);
      } else {
        subs.push({ ...u.$set });
      }
      return {};
    }),
  };
  const plans = {
    planFor: jest.fn().mockResolvedValue({ key: opts.planKey ?? 'FREE' }),
    getConfig: jest.fn().mockResolvedValue({
      monthlyPrice: opts.price ?? 2500,
      yearlyPrice: 25000,
    }),
    subscriptionOf: jest.fn(async () => {
      return subs[0] ?? null;
    }),
  };
  const paystack = {
    initialize: jest.fn().mockResolvedValue({
      reference: 'ref_1',
      authorizationUrl: 'https://checkout.paystack.com/x',
    }),
    verify: jest.fn().mockResolvedValue(opts.tx),
  };
  const service = new TimerBillingService(
    paymentModel as any,
    subscriptionModel as any,
    {} as any,
    {} as any,
    {} as any,
    plans as any,
    paystack as any,
    {
      countActive: async () => {
        return 1;
      },
    } as any,
    {
      register: () => {
        return undefined;
      },
    } as any,
  );
  return { service, payments, subs, paystack };
}

describe('TimerBillingService', () => {
  it('starts a Paystack checkout marked as a timer payment', async () => {
    const { service, paystack, payments } = billing();
    const res = await service.checkout(
      admin,
      TimerBillingCycle.MONTHLY,
      'https://timer.test/billing',
    );
    expect(res.authorizationUrl).toContain('paystack');
    expect(paystack.initialize).toHaveBeenCalledWith({
      email: 'ada@example.com',
      amountNaira: 2500,
      callbackUrl: 'https://timer.test/billing',
      metadata: expect.objectContaining({
        type: TIMER_PAYMENT_TYPE,
        cycle: 'monthly',
      }),
    });
    expect(payments[0]).toMatchObject({
      reference: 'ref_1',
      amount: 2500,
      status: 'pending',
    });
  });

  it("won't charge a Church Workflow church, or with no price set", async () => {
    await expect(
      billing({ planKey: 'CHURCH_WORKFLOW' }).service.checkout(
        admin,
        TimerBillingCycle.MONTHLY,
        'x',
      ),
    ).rejects.toThrow(BadRequestException);
    await expect(
      billing({ price: 0 }).service.checkout(
        admin,
        TimerBillingCycle.MONTHLY,
        'x',
      ),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  const pending = () => {
    return {
      _id: 'p1',
      churchId,
      reference: 'ref_1',
      amount: 2500,
      cycle: TimerBillingCycle.MONTHLY,
      status: TimerPaymentStatus.PENDING,
      createdAt: new Date(),
    };
  };

  it('applies a successful payment once, even if confirmed twice', async () => {
    const { service, subs } = billing({
      payment: pending(),
      tx: { status: 'success', amount: 250000, paid_at: now.toISOString() },
    });
    expect((await service.confirm(churchId, 'ref_1')).status).toBe('success');
    const firstEnd = subs[0].currentPeriodEnd;
    expect(firstEnd.getTime()).toBeGreaterThan(Date.now() + 27 * day);
    await service.confirm(churchId, 'ref_1');
    expect(subs[0].currentPeriodEnd).toBe(firstEnd);
  });

  it("doesn't apply a payment for less than the price", async () => {
    const { service, subs } = billing({
      payment: pending(),
      tx: { status: 'success', amount: 1000 },
    });
    expect((await service.confirm(churchId, 'ref_1')).status).toBe('pending');
    expect(subs).toHaveLength(0);
  });

  it('marks failed and long-abandoned checkouts as failed', async () => {
    const failed = billing({ payment: pending(), tx: { status: 'failed' } });
    expect((await failed.service.confirm(churchId, 'ref_1')).status).toBe(
      'failed',
    );
    const old = billing({
      payment: { ...pending(), createdAt: new Date(Date.now() - 2 * day) },
      tx: { status: 'abandoned' },
    });
    expect((await old.service.confirm(churchId, 'ref_1')).status).toBe(
      'failed',
    );
    const recent = billing({ payment: pending(), tx: { status: 'abandoned' } });
    expect((await recent.service.confirm(churchId, 'ref_1')).status).toBe(
      'pending',
    );
  });
});

describe('branding on the Free plan', () => {
  const settingsDoc = {
    _id: 's1',
    churchId,
    colors: { ...COLOUR_PRESETS[0] },
    logoUrl: null,
  };
  const build = (customBranding: boolean) => {
    const settingsModel = {
      findOneAndUpdate: jest.fn(async () => {
        return settingsDoc;
      }),
      exists: async () => {
        return null;
      },
    };
    const svc = new ServiceTimerService(
      settingsModel as any,
      {} as any,
      {} as any,
      {
        findById: () => {
          return {
            select: () => {
              return {
                lean: async () => {
                  return { name: 'Grace' };
                },
              };
            },
          };
        },
      } as any,
      { uploadFile: jest.fn() } as any,
      {} as any,
      {} as any,
      { emitToBranch: jest.fn() } as any,
      {
        planFor: async () => {
          return {
            key: customBranding ? 'CHURCH' : 'FREE',
            customBranding,
            showMark: !customBranding,
          };
        },
      } as any,
    );
    return { svc, settingsModel };
  };
  const scope = { churchId, branchId: new Types.ObjectId() };

  it('allows presets but not custom colours or a logo', async () => {
    const { svc } = build(false);
    await expect(
      svc.updateSettings(scope, { colors: { ...COLOUR_PRESETS[1] } }),
    ).resolves.toBeDefined();
    const err = await svc
      .updateSettings(scope, { colors: { bg: '#123456' } })
      .catch((e) => {
        return e;
      });
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getResponse()).toMatchObject({ code: 'PLAN_REQUIRED' });
    await expect(
      svc.uploadLogo(scope, { buffer: Buffer.from('x') } as any),
    ).rejects.toThrow(HttpException);
  });

  it('allows them on the Church plan, and shows the mark only on Free', async () => {
    const church = build(true);
    await expect(
      church.svc.updateSettings(scope, { colors: { bg: '#123456' } }),
    ).resolves.toBeDefined();
    expect((await church.svc.getSettings(scope)).plan).toMatchObject({
      showMark: false,
    });
    expect((await build(false).svc.getSettings(scope)).plan).toMatchObject({
      showMark: true,
    });
  });
});
