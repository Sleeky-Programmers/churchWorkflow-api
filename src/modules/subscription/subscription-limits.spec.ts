import { Types } from 'mongoose';

import { PlanType } from '../../common/utils/enums.utils';
import { DEFAULT_PLAN_CONFIG } from './plan-defaults';
import { SubscriptionService } from './subscription.service';

const churchId = new Types.ObjectId();

function build(sub: Record<string, any>) {
  const service = new SubscriptionService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    { get: () => undefined } as any,
  );
  const cache: Map<PlanType, any> = (service as any).planConfigCache;
  for (const plan of Object.values(PlanType)) {
    cache.set(plan, { plan, ...DEFAULT_PLAN_CONFIG[plan] });
  }
  jest.spyOn(service, 'getSubscription').mockResolvedValue(sub as any);
  return service;
}

describe('plan defaults', () => {
  it('match the pricing document', () => {
    const p = DEFAULT_PLAN_CONFIG;
    expect([
      p.STARTER.monthlyPrice,
      p.GROWTH.monthlyPrice,
      p.EXPANSION.monthlyPrice,
      p.ENTERPRISE.monthlyPrice,
    ]).toEqual([0, 5000, 10000, 50000]);
    expect([
      p.STARTER.guestLimit,
      p.GROWTH.guestLimit,
      p.EXPANSION.guestLimit,
      p.ENTERPRISE.guestLimit,
    ]).toEqual([200, 1500, 6000, -1]);
    expect([
      p.STARTER.memberLimit,
      p.GROWTH.memberLimit,
      p.EXPANSION.memberLimit,
    ]).toEqual([100, 500, 1500]);
    expect([
      p.STARTER.branchLimit,
      p.GROWTH.branchLimit,
      p.EXPANSION.branchLimit,
    ]).toEqual([1, 5, 25]);
    expect([
      p.STARTER.userLimit,
      p.GROWTH.userLimit,
      p.EXPANSION.userLimit,
    ]).toEqual([3, 10, 25]);
    // Yearly keeps the ~17% discount: 10 × monthly.
    expect(p.GROWTH.yearlyPrice).toBe(p.GROWTH.monthlyPrice * 10);
    expect(p.EXPANSION.yearlyPrice).toBe(p.EXPANSION.monthlyPrice * 10);
    expect(p.ENTERPRISE.contactSales).toBe(true);
  });
});

describe('SubscriptionService limits', () => {
  it('names the guest limit and the plan to upgrade to', async () => {
    const service = build({
      plan: PlanType.STARTER,
      memberLimit: 100,
      guestLimit: 200,
    });
    const res = await service.checkGuestLimit(churchId, 201);
    expect(res.allowed).toBe(false);
    expect(res.message).toBe(
      "You've reached your plan's guest limit (200 guests). Upgrade to Growth for 1,500 guests.",
    );
  });

  it('points Expansion churches to Contact us for Enterprise', async () => {
    const service = build({
      plan: PlanType.EXPANSION,
      memberLimit: 1500,
      guestLimit: 6000,
    });
    const res = await service.checkMemberLimit(churchId, 1501);
    expect(res.message).toContain(
      'Contact us about Enterprise for unlimited members',
    );
  });

  it('falls back to the plan limit for legacy subscriptions without guestLimit', async () => {
    const service = build({ plan: PlanType.GROWTH, memberLimit: 500 });
    expect((await service.getEffectiveLimit(churchId, 'guest')).limit).toBe(
      1500,
    );
    expect((await service.checkGuestLimit(churchId, 1500)).allowed).toBe(true);
  });

  it('treats -1 as unlimited', async () => {
    const service = build({
      plan: PlanType.ENTERPRISE,
      memberLimit: -1,
      guestLimit: -1,
    });
    expect((await service.checkGuestLimit(churchId, 1_000_000)).allowed).toBe(
      true,
    );
  });

  it('Enterprise is not self-serve', () => {
    const service = build({ plan: PlanType.STARTER });
    expect(service.isContactSalesPlan(PlanType.ENTERPRISE)).toBe(true);
    expect(service.isContactSalesPlan(PlanType.GROWTH)).toBe(false);
  });
});
