import { BadRequestException } from '@nestjs/common';

import {
  TimerBillingCycle,
  TimerPlan,
} from '../../../schemas/timer-billing.schema';
import { TimerBillingService } from './timer-billing.service';

/** Product admins changing the timer's prices (the admin app's plans screen). */
function setup(opts: { inUse?: string[]; failCodes?: string[] } = {}) {
  const configs: Record<string, any> = {
    [TimerPlan.FREE]: {
      plan: TimerPlan.FREE,
      name: 'Free',
      monthlyPrice: 0,
      yearlyPrice: 0,
      userLimit: 2,
      importLimit: 1,
      branchLimit: 1,
      customBranding: false,
    },
    [TimerPlan.CHURCH]: {
      plan: TimerPlan.CHURCH,
      name: 'Church',
      monthlyPrice: 2500,
      yearlyPrice: 25000,
      userLimit: 5,
      importLimit: 30,
      branchLimit: 5,
      customBranding: true,
      paystackPlans: {
        monthly: { code: 'PLN_m', amount: 2500 },
        yearly: { code: 'PLN_y', amount: 25000 },
      },
    },
  };
  const plans = {
    getConfig: async (p: TimerPlan) => structuredClone(configs[p]),
    listConfigs: async () =>
      Object.values(configs).map((c) => structuredClone(c)),
    updateConfig: jest.fn(async (p: TimerPlan, patch: any) => {
      Object.assign(configs[p], patch);
      return configs[p];
    }),
    setPaystackPlan: jest.fn(async (cycle: string, v: any) => {
      configs[TimerPlan.CHURCH].paystackPlans[cycle] = v;
    }),
    clearPaystackPlan: jest.fn(async (cycle: string) => {
      delete configs[TimerPlan.CHURCH].paystackPlans[cycle];
    }),
  };
  const subs = {
    aggregate: async () => [
      { _id: TimerBillingCycle.MONTHLY, n: 3 },
      { _id: TimerBillingCycle.YEARLY, n: 1 },
    ],
    distinct: jest.fn(async (_f: string, q: any) =>
      q.cycle === TimerBillingCycle.MONTHLY ? (opts.inUse ?? []) : [],
    ),
  };
  const paystack = {
    updatePlanAmount: jest.fn(async (code: string) => {
      if (opts.failCodes?.includes(code)) {
        throw new Error('Plan not found');
      }
    }),
  };
  const service = new TimerBillingService(
    {} as any,
    subs as any,
    {} as any,
    {} as any,
    {} as any,
    plans as any,
    paystack as any,
    {} as any,
    { register: () => undefined } as any,
  );
  return { service, configs, plans, paystack, subs };
}

describe('Timer plans for product admins', () => {
  it('lists both plans with how many churches renew by themselves', async () => {
    const { service } = setup();
    const list = await service.adminPlans();
    expect(list.map((p) => p.plan)).toEqual([TimerPlan.FREE, TimerPlan.CHURCH]);
    expect(list[1].autoRenewing).toEqual({ monthly: 3, yearly: 1 });
    expect(list[0].autoRenewing).toBeNull();
    expect(list[1]).not.toHaveProperty('paystackPlans');
  });

  it('moves auto-renewals to a new price, including older Paystack plans still in use', async () => {
    const s = setup({ inUse: ['PLN_m', 'PLN_old'] });
    const res = await s.service.updateAdminPlan(
      TimerPlan.CHURCH,
      { monthlyPrice: 3000 },
      null,
    );
    expect(s.paystack.updatePlanAmount.mock.calls).toEqual([
      ['PLN_m', 3000],
      ['PLN_old', 3000],
    ]);
    expect(s.configs.CHURCH.paystackPlans.monthly).toEqual({
      code: 'PLN_m',
      amount: 3000,
    });
    expect(res.monthlyPrice).toBe(3000);
    expect(res.paystack).toEqual([
      { cycle: TimerBillingCycle.MONTHLY, updated: 2, failed: 0 },
    ]);
  });

  it('leaves Paystack alone when only limits change', async () => {
    const s = setup();
    const res = await s.service.updateAdminPlan(
      TimerPlan.CHURCH,
      { userLimit: 8, monthlyPrice: 2500 },
      null,
    );
    expect(s.paystack.updatePlanAmount).not.toHaveBeenCalled();
    expect(res.userLimit).toBe(8);
    expect(res.paystack).toEqual([]);
  });

  it('drops a Paystack plan it could not reprice, so the next checkout makes a new one', async () => {
    const s = setup({ failCodes: ['PLN_y'] });
    const res = await s.service.updateAdminPlan(
      TimerPlan.CHURCH,
      { yearlyPrice: 30000 },
      null,
    );
    expect(s.plans.clearPaystackPlan).toHaveBeenCalledWith(
      TimerBillingCycle.YEARLY,
    );
    expect(s.configs.CHURCH.paystackPlans.yearly).toBeUndefined();
    expect(s.configs.CHURCH.yearlyPrice).toBe(30000);
    expect(res.paystack).toEqual([
      { cycle: TimerBillingCycle.YEARLY, updated: 0, failed: 1 },
    ]);
  });

  it('refuses a free Church plan and a priced Free plan', async () => {
    const s = setup();
    await expect(
      s.service.updateAdminPlan(TimerPlan.CHURCH, { monthlyPrice: 0 }, null),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      s.service.updateAdminPlan(TimerPlan.FREE, { monthlyPrice: 500 }, null),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(s.plans.updateConfig).not.toHaveBeenCalled();
  });
});
