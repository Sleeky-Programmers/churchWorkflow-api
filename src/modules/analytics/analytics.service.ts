import { Injectable } from '@nestjs/common';
import { ChurchService } from '../church/church.service';
import { MembersService } from '../members/members.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { AttendanceService } from '../attendance/attendance.service';
import { PaymentService } from '../payment/payment.service';
import { PlanType } from '../../common/utils/enums.utils';

function fmtGrowth(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? '+100%' : '0%';
  }
  const g = ((current - previous) / previous) * 100;
  const sign = g >= 0 ? '+' : '';
  return `${sign}${g.toFixed(1)}%`;
}

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly churchService: ChurchService,
    private readonly membersService: MembersService,
    private readonly subscriptionService: SubscriptionService,
    private readonly attendanceService: AttendanceService,
    private readonly paymentService: PaymentService,
  ) {}

  async getOverviewStats() {
    const [totalChurches, newChurchesLast30Days, totalMembers] =
      await Promise.all([
        this.churchService.countAll(),
        this.churchService.countRegisteredSince(30),
        this.membersService.countAllMembers(),
      ]);

    const [totalActivePlans, totalStarterPlans, countsByPlan] =
      await Promise.all([
        this.subscriptionService.countActiveSubscriptions(),
        this.subscriptionService.countByPlan(PlanType.STARTER),
        this.subscriptionService.getCountsByPlan(),
      ]);

    return {
      totalChurches,
      newChurchesLast30Days,
      totalMembers,
      totalActivePlans,
      totalStarterPlans,
      churchesByPlan: countsByPlan,
    };
  }

  async getAnalytics() {
    const now = new Date();
    const since = new Date();
    since.setDate(now.getDate() - 30);
    const prevFrom = new Date();
    prevFrom.setDate(now.getDate() - 60);

    const [totalChurches, newChurches] = await Promise.all([
      this.churchService.countAll(),
      this.churchService.countRegisteredSince(30),
    ]);
    const prevTotalChurches = Math.max(totalChurches - newChurches, 0);
    const churchesGrowth = fmtGrowth(totalChurches, prevTotalChurches);

    const [totalMembers, membersRegisteredLast30Days] = await Promise.all([
      this.membersService.countAllMembers(),
      this.membersService.countRegisteredSince(30),
    ]);
    const prevTotalMembers = Math.max(
      totalMembers - membersRegisteredLast30Days,
      0,
    );
    const totalMembersGrowth = fmtGrowth(totalMembers, prevTotalMembers);

    const [activeMembersNow, activeMembersPrev] = await Promise.all([
      this.attendanceService.countDistinctPresentMembers(30),
      this.attendanceService.countDistinctPresentMembersBetween(
        prevFrom.toISOString(),
        since.toISOString(),
      ),
    ]);
    const activeMembersGrowth = fmtGrowth(activeMembersNow, activeMembersPrev);

    const [mrrNow, mrrPrev, totalRevenueNow, totalRevenuePrev] =
      await Promise.all([
        this.paymentService.getMRRForChurchIds(),
        this.paymentService.getMRRBetween(prevFrom, since),
        this.paymentService.getRevenueBetween(since, now),
        this.paymentService.getRevenueBetween(prevFrom, since),
      ]);

    const mrrGrowth = fmtGrowth(mrrNow, mrrPrev);
    const totalRevenueGrowth = fmtGrowth(totalRevenueNow, totalRevenuePrev);

    const countsByPlan = await this.subscriptionService.getCountsByPlan();

    const totalSubscriptions = Object.values(countsByPlan).reduce(
      (a: number, b: number) => a + (b || 0),
      0,
    );

    const plansList = Object.values(PlanType);
    const planDistribution: Record<string, number> = {};
    for (const plan of plansList) {
      const percentage = totalSubscriptions
        ? ((countsByPlan[plan] || 0) / totalSubscriptions) * 100
        : 0;
      planDistribution[plan] = parseFloat(percentage.toFixed(2));
    }

    const newByPlanNow =
      await this.subscriptionService.countNewSubscriptionsByPlanBetween(
        since,
        now,
      );
    const newByPlanPrev =
      await this.subscriptionService.countNewSubscriptionsByPlanBetween(
        prevFrom,
        since,
      );

    let mostUsedPlan = null;
    let mostUsedCount = 0;
    for (const [plan, cnt] of Object.entries(countsByPlan)) {
      if ((cnt || 0) > mostUsedCount) {
        mostUsedCount = cnt as number;
        mostUsedPlan = plan;
      }
    }

    const mostUsedPlanNewNow = mostUsedPlan
      ? newByPlanNow[mostUsedPlan] || 0
      : 0;
    const mostUsedPlanNewPrev = mostUsedPlan
      ? newByPlanPrev[mostUsedPlan] || 0
      : 0;
    const mostUsedPlanGrowth = fmtGrowth(
      mostUsedPlanNewNow,
      mostUsedPlanNewPrev,
    );

    const plans = Object.values(PlanType);
    const planPerformance = [] as any[];

    for (const plan of plans) {
      const churchIds = await this.subscriptionService.getChurchIdsByPlan(plan);
      const churchesCount = countsByPlan[plan] || 0;
      const membersCount = await this.membersService.countMembersByChurchIds(
        churchIds || [],
      );
      const monthlyRevenue = await this.paymentService.getMRRForChurchIds(
        churchIds || [],
      );
      const newNow = newByPlanNow[plan] || 0;
      const newPrev = newByPlanPrev[plan] || 0;
      const growth = fmtGrowth(newNow, newPrev);

      planPerformance.push({
        plan,
        churchesCount,
        membersCount,
        monthlyRevenue,
        growth,
      });
    }

    const starterCount = countsByPlan[PlanType.STARTER] || 0;
    const nonStarterCount = totalSubscriptions - starterCount;
    const conversionRate = totalSubscriptions
      ? (nonStarterCount / totalSubscriptions) * 100
      : 0;

    const newStarterPrev = newByPlanPrev[PlanType.STARTER] || 0;

    const newNonStarterPrev = Object.keys(newByPlanPrev).reduce(
      (acc, k) =>
        k === PlanType.STARTER ? acc : acc + (newByPlanPrev[k] || 0),
      0,
    );

    const conversionRatePrev =
      prevFrom && prevFrom
        ? (newNonStarterPrev / (newStarterPrev + newNonStarterPrev || 1)) * 100
        : 0;
    const conversionRateGrowth = fmtGrowth(conversionRate, conversionRatePrev);

    return {
      timestamp: now.toISOString(),
      totalChurches: { count: totalChurches, growth: churchesGrowth },
      members: {
        active: { count: activeMembersNow, growth: activeMembersGrowth },
        total: { count: totalMembers, growth: totalMembersGrowth },
      },
      revenue: {
        monthlyRecurringRevenue: { amount: mrrNow, growth: mrrGrowth },
        totalRevenue: { amount: totalRevenueNow, growth: totalRevenueGrowth },
      },
      conversionRate: {
        value: `${conversionRate.toFixed(2)}%`,
        growth: conversionRateGrowth,
      },
      mostUsedPlan: {
        plan: mostUsedPlan,
        count: mostUsedCount,
        growth: mostUsedPlanGrowth,
      },
      planDistribution,
      planPerformanceBreakdown: planPerformance,
    };
  }
}
