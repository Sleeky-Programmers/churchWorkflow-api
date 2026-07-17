import { Injectable } from '@nestjs/common';

import { AnalyticsPeriod, PlanType } from '../../common/utils/enums.utils';
import { AttendanceService } from '../attendance/attendance.service';
import { ChurchService } from '../church/church.service';
import { MembersService } from '../members/members.service';
import { PaymentService } from '../payment/payment.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { AnalyticsFilterDto } from './dto/analytics-filter.dto';

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

    // Get attendance trend for the last 6 months
    const attendanceTrend = await this.getAttendanceTrendForOverview();

    return {
      totalChurches,
      newChurchesLast30Days,
      totalMembers,
      totalActivePlans,
      totalStarterPlans,
      churchesByPlan: countsByPlan,
      attendanceTrend,
    };
  }

  // Alternative: Get attendance trend by service type (regular vs special)
  async getAttendanceTrendByType(year?: number) {
    const targetYear = year || new Date().getFullYear();

    // Use the new platform-wide method
    const attendanceData =
      await this.attendanceService.getPlatformWideAttendanceTrend(targetYear);

    // Format for frontend if needed
    return attendanceData;
  }

  private getDateRange(period?: AnalyticsPeriod) {
    const now = new Date();
    let startDate: Date;
    let compareStartDate: Date;

    switch (period) {
      case AnalyticsPeriod.DAILY:
        // Last 30 days
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 30);
        compareStartDate = new Date(startDate);
        compareStartDate.setDate(compareStartDate.getDate() - 30);
        break;
      case AnalyticsPeriod.WEEKLY:
        // Last 7 weeks
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 49);
        compareStartDate = new Date(startDate);
        compareStartDate.setDate(compareStartDate.getDate() - 49);
        break;
      case AnalyticsPeriod.MONTHLY:
        // Last 12 months
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 12);
        compareStartDate = new Date(startDate);
        compareStartDate.setMonth(compareStartDate.getMonth() - 12);
        break;
      case AnalyticsPeriod.YEARLY:
      default:
        // Last 3 years
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 3);
        compareStartDate = new Date(startDate);
        compareStartDate.setFullYear(compareStartDate.getFullYear() - 3);
        break;
    }

    return { now, startDate, compareStartDate };
  }

  private getMonthsForPeriod(period?: AnalyticsPeriod) {
    const now = new Date();
    const months = [] as { start: Date; end: Date; label: string }[];

    let seriesCount: number;
    switch (period) {
      case AnalyticsPeriod.DAILY:
        seriesCount = 30;
        break;
      case AnalyticsPeriod.WEEKLY:
        seriesCount = 7;
        break;
      case AnalyticsPeriod.MONTHLY:
        seriesCount = 12;
        break;
      case AnalyticsPeriod.YEARLY:
      default:
        seriesCount = 36; // 3 years
        break;
    }

    const firstOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    for (let i = seriesCount - 1; i >= 0; i--) {
      let mStart: Date;
      let label: string;

      if (period === AnalyticsPeriod.DAILY) {
        mStart = new Date(now);
        mStart.setDate(now.getDate() - i);
        label = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, '0')}-${String(mStart.getDate()).padStart(2, '0')}`;
      } else if (period === AnalyticsPeriod.WEEKLY) {
        mStart = new Date(now);
        mStart.setDate(now.getDate() - i * 7);
        label = `Week ${i + 1}`;
      } else {
        mStart = new Date(
          firstOfThisMonth.getFullYear(),
          firstOfThisMonth.getMonth() - i,
          1,
        );
        label = `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, '0')}`;
      }

      const mEnd = new Date(mStart);
      if (period === AnalyticsPeriod.DAILY) {
        mEnd.setDate(mEnd.getDate() + 1);
      } else if (period === AnalyticsPeriod.WEEKLY) {
        mEnd.setDate(mEnd.getDate() + 7);
      } else {
        mEnd.setMonth(mEnd.getMonth() + 1);
      }

      months.push({ start: mStart, end: mEnd, label });
    }

    return months;
  }

  async getAnalytics(filterDto: AnalyticsFilterDto = {}) {
    const { period } = filterDto;
    const { now, startDate, compareStartDate } = this.getDateRange(period);
    const since = startDate;
    const prevFrom = compareStartDate;

    // If no period specified, use the default (yearly - 3 years)
    const useDefault = !period;

    const [totalChurches, newChurches] = await Promise.all([
      this.churchService.countAll(),
      this.churchService.countRegisteredSince(
        useDefault ? 30 : this.getDaysSince(startDate),
      ),
    ]);
    const prevTotalChurches = Math.max(totalChurches - newChurches, 0);
    const churchesGrowth = fmtGrowth(totalChurches, prevTotalChurches);

    const [totalMembers, membersRegisteredLast30Days] = await Promise.all([
      this.membersService.countAllMembers(),
      this.membersService.countRegisteredSince(
        useDefault ? 30 : this.getDaysSince(startDate),
      ),
    ]);
    const prevTotalMembers = Math.max(
      totalMembers - membersRegisteredLast30Days,
      0,
    );
    const totalMembersGrowth = fmtGrowth(totalMembers, prevTotalMembers);

    const [activeMembersNow, activeMembersPrev] = await Promise.all([
      this.attendanceService.countDistinctPresentMembers(
        useDefault ? 30 : this.getDaysSince(startDate),
      ),
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

    const months = this.getMonthsForPeriod(period);

    const revenueSubscriptionData = [] as any[];
    const trialToPaidData = [] as any[];
    const membersGrowth = [] as any[];

    for (const month of months) {
      const revenue = await this.paymentService.getRevenueBetween(
        month.start,
        month.end,
      );
      const newSubsMap =
        await this.subscriptionService.countNewSubscriptionsByPlanBetween(
          month.start,
          month.end,
        );
      const subsTotal = Object.values(newSubsMap).reduce(
        (a: number, b: number) => a + (b || 0),
        0,
      );
      revenueSubscriptionData.push({
        month: month.label,
        revenue,
        subscription: subsTotal,
      });

      const statusMap =
        await this.subscriptionService.countSubscriptionsByStatusBetween(
          month.start,
          month.end,
        );
      const trialCount = statusMap['TRIAL'] || 0;
      const conversionCount = Object.keys(statusMap).reduce(
        (acc, k) => (k === 'TRIAL' ? acc : acc + (statusMap[k] || 0)),
        0,
      );
      trialToPaidData.push({
        month: month.label,
        trial: trialCount,
        conversion: conversionCount,
      });

      const active =
        await this.attendanceService.countDistinctPresentMembersBetween(
          month.start.toISOString(),
          month.end.toISOString(),
        );
      const total = await this.membersService.countMembersUpTo(month.end);
      membersGrowth.push({ month: month.label, active, total });
    }

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
      revenueSubscriptionData,
      trialToPaidData,
      membersGrowth,
    };
  }

  private getDaysSince(date: Date): number {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    return Math.ceil(diff / (1000 * 3600 * 24));
  }
  // Analytics.service.ts
  private async getAttendanceTrendForOverview() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    // Get last 6 months of data
    const startMonth = Math.max(0, currentMonth - 5);
    const months = [];

    for (let i = startMonth; i <= currentMonth; i++) {
      months.push({
        month: new Date(currentYear, i, 1).toLocaleString('default', {
          month: 'short',
        }),
        monthIndex: i,
      });
    }

    const trendData = [];

    for (let i = 0; i < months.length; i++) {
      const currentMonthIndex = months[i].monthIndex;
      const currentMonthStart = new Date(currentYear, currentMonthIndex, 1);
      const currentMonthEnd = new Date(currentYear, currentMonthIndex + 1, 1);

      const currentMonthAttendance =
        await this.attendanceService.getPlatformWideAttendanceCount(
          currentMonthStart,
          currentMonthEnd,
        );

      let previousMonthAttendance = 0;
      if (currentMonthIndex > 0) {
        const previousMonthStart = new Date(
          currentYear,
          currentMonthIndex - 1,
          1,
        );
        const previousMonthEnd = new Date(currentYear, currentMonthIndex, 1);

        previousMonthAttendance =
          await this.attendanceService.getPlatformWideAttendanceCount(
            previousMonthStart,
            previousMonthEnd,
          );
      }

      trendData.push({
        month: months[i].month,
        thisMonth: currentMonthAttendance,
        lastMonth: previousMonthAttendance,
      });
    }

    return trendData;
  }
}
