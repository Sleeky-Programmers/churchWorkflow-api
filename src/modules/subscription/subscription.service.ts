import { Model, PipelineStage, Types } from 'mongoose';

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import {
  BillingCycle,
  MemberLimitType,
  NotificationType,
  PaymentProvider,
  PlanType,
  SubscriptionStatus,
} from '../../common/utils/enums.utils';
import { Subscription } from '../../schemas/subscription.schema';
import { AdminActivityLogService } from '../admin-activity-log/admin-activity-log.service';
import {
  NotificationService,
} from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
    private paymentService: PaymentService,
    private adminActivityLogService: AdminActivityLogService,
    private notificationService: NotificationService,
  ) {}

  private readonly planLimits = {
    [PlanType.STARTER]: {
      members: 100,
      users: 3,
      branches: 2,
      customRoles: false,
    },
    [PlanType.GROWTH]: {
      members: 500,
      users: 10,
      branches: 5,
      customRoles: true,
    },
    [PlanType.EXPANSION]: {
      members: 1500,
      users: 25,
      branches: 25,
      customRoles: true,
    },
    [PlanType.ENTERPRISE]: {
      members: -1,
      users: -1,
      branches: -1,
      customRoles: true,
    },
  };

  private readonly planRank: Record<PlanType, number> = {
    [PlanType.STARTER]: 0,
    [PlanType.GROWTH]: 1,
    [PlanType.EXPANSION]: 2,
    [PlanType.ENTERPRISE]: 3,
  };

  getPlanAmount(plan: PlanType, billingCycle: BillingCycle): number {
    const pricing: Record<PlanType, Record<BillingCycle, number>> = {
      [PlanType.STARTER]: {
        [BillingCycle.MONTHLY]: 0,
        [BillingCycle.YEARLY]: 0,
      },
      [PlanType.GROWTH]: {
        [BillingCycle.MONTHLY]: 20000,
        [BillingCycle.YEARLY]: 200000,
      },
      [PlanType.EXPANSION]: {
        [BillingCycle.MONTHLY]: 45000,
        [BillingCycle.YEARLY]: 450000,
      },
      [PlanType.ENTERPRISE]: {
        [BillingCycle.MONTHLY]: 100000,
        [BillingCycle.YEARLY]: 1000000,
      },
    };

    const planPricing = pricing[plan] || pricing[PlanType.STARTER];
    return planPricing[billingCycle] ?? planPricing[BillingCycle.MONTHLY];
  }

  async getSubscription(churchId: Types.ObjectId) {
    const subscription = await this.findOrCreateSubscription(churchId);

    const now = new Date();
    if (subscription.endDate && now > subscription.endDate) {
      if (!subscription.gracePeriodEndDate) {
        const grace = new Date(subscription.endDate);
        grace.setDate(grace.getDate() + 7);
        subscription.gracePeriodEndDate = grace;
        subscription.status = SubscriptionStatus.GRACE;
        await subscription.save();
        return subscription;
      }

      if (
        subscription.gracePeriodEndDate &&
        now <= subscription.gracePeriodEndDate
      ) {
        if (subscription.status !== SubscriptionStatus.GRACE) {
          subscription.status = SubscriptionStatus.GRACE;
          await subscription.save();
        }
        return subscription;
      }

      if (
        subscription.gracePeriodEndDate &&
        now > subscription.gracePeriodEndDate
      ) {
        if (subscription.status !== SubscriptionStatus.EXPIRED) {
          subscription.status = SubscriptionStatus.EXPIRED;
          await subscription.save();
        }
        return subscription;
      }
    }

    return subscription;
  }

  // Atomic find-or-create, to prevent duplicate Subscription docs per church.
  async findOrCreateSubscription(churchId: Types.ObjectId) {
    const limits = this.planLimits[PlanType.STARTER];
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    return this.subscriptionModel.findOneAndUpdate(
      { churchId },
      {
        $setOnInsert: {
          churchId,
          plan: PlanType.STARTER,
          status: SubscriptionStatus.TRIAL,
          memberLimit: limits.members,
          userLimit: limits.users,
          branchLimit: limits.branches,
          customRolesEnabled: limits.customRoles,
          endDate: trialEndDate,
          gracePeriodEndDate: trialEndDate,
        },
      },
      { new: true, upsert: true },
    );
  }

  async initializeTrialPlan(churchId: Types.ObjectId) {
    return this.findOrCreateSubscription(churchId);
  }

  async createTrialSubscription(churchId: Types.ObjectId) {
    return this.findOrCreateSubscription(churchId);
  }

  async updateSubscription(data: {
    churchId: Types.ObjectId;
    plan: PlanType;
    billingCycle: BillingCycle;
    autoRenew?: boolean;
    providerData?: {
      subscriptionCode?: string;
      emailToken?: string;
      customerCode?: string;
      provider?: PaymentProvider;
      transactionId?: string;
      paymentType?: string;
    };
  }) {
    const existing = await this.subscriptionModel.findOne({
      churchId: new Types.ObjectId(data.churchId),
    });

    const limits = this.planLimits[data.plan];
    const startDate = new Date();
    const endDate = new Date();

    if (data.billingCycle === BillingCycle.MONTHLY) {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    // A plan change (not a first purchase or a same-plan renewal) carries over whatever time is still left on the old plan onto the new plan.
    const isPlanChange =
      !!existing &&
      existing.plan !== data.plan &&
      existing.plan !== PlanType.STARTER &&
      existing.status === SubscriptionStatus.ACTIVE;

    if (isPlanChange && existing.endDate && existing.endDate > startDate) {
      const remainingMs = existing.endDate.getTime() - startDate.getTime();
      endDate.setTime(endDate.getTime() + remainingMs);
    }

    const updated = await this.subscriptionModel.findOneAndUpdate(
      { churchId: new Types.ObjectId(data.churchId) },
      {
        plan: data.plan,
        status: SubscriptionStatus.ACTIVE,
        memberLimit: limits.members,
        userLimit: limits.users,
        branchLimit: limits.branches,
        customRolesEnabled: limits.customRoles,
        startDate,
        endDate,
        isAutoRenew: data.autoRenew,
        gracePeriodEndDate: null,

        ...(data.providerData && {
          provider: {
            name: data.providerData.provider || PaymentProvider.PAYSTACK,
            subscriptionCode: data.providerData.subscriptionCode,
            emailToken: data.providerData.emailToken,
            customerCode: data.providerData.customerCode,
            transactionId: data.providerData.transactionId || null,
          },
        }),
      },
      { new: true, upsert: true },
    );

    if (!existing) {
      await this.adminActivityLogService.create({
        action: 'Subscription Created',
        details: `Subscription created for plan ${data.plan}`,
        plan: data.plan as any,
      } as any);
      await this.notificationService.createNotification(data.churchId, {
        title: 'Subscription Activated',
        body: `Your ${data.plan} plan subscription is now active.`,
        type: NotificationType.SUBSCRIPTION,
      });
    } else if (existing.plan !== data.plan) {
      const isUpgrade = this.planRank[data.plan] > this.planRank[existing.plan];
      await this.adminActivityLogService.create({
        action: isUpgrade ? 'Subscription Upgraded' : 'Subscription Downgraded',
        details:
          `Subscription changed from ${existing.plan} to ${data.plan}` +
          (isPlanChange ? ' (remaining duration carried over)' : ''),
        plan: data.plan as any,
      } as any);
      await this.notificationService.createNotification(data.churchId, {
        title: isUpgrade
          ? 'Subscription Upgraded 🎉'
          : 'Subscription Plan Changed',
        body: isUpgrade
          ? `Your church has been upgraded from the ${existing.plan} plan to the ${data.plan} plan. Enjoy your new features!`
          : `Your plan was changed from ${existing.plan} to ${data.plan}.`,
        type: NotificationType.SUBSCRIPTION,
      });
    } else {
      await this.adminActivityLogService.create({
        action: 'Subscription Updated',
        details: `Subscription updated for plan ${data.plan}`,
        plan: data.plan as any,
      } as any);
    }

    return updated;
  }

  async isActiveAutoRenewing(churchId: Types.ObjectId) {
    const subscription = await this.getSubscription(churchId);

    return (
      subscription?.isAutoRenew &&
      subscription?.provider?.subscriptionCode &&
      subscription?.status === SubscriptionStatus.ACTIVE
    );
  }

  async checkMemberLimit(churchId: Types.ObjectId, projectedCount: number) {
    const sub = await this.getSubscription(churchId);

    if (sub.memberLimit === -1) {
      return { allowed: true, type: MemberLimitType.NONE };
    }

    if (projectedCount > sub.memberLimit) {
      return {
        allowed: false,
        message:
          'You cannot add more members because it will be more than the member limit for your plan. Upgrade to continue.',
        type: MemberLimitType.BLOCK,
      };
    }

    return { allowed: true, type: MemberLimitType.NONE };
  }

  async checkUserLimit(churchId: Types.ObjectId, currentUserCount: number) {
    const sub = await this.getSubscription(churchId);
    if (sub.userLimit === -1) {
      return { allowed: true };
    }

    if (currentUserCount >= sub.userLimit) {
      return {
        allowed: false,
        message: `You're using ${currentUserCount} of ${sub.userLimit} user seats. Remove a user, cancel a pending invite, or upgrade to add more.`,
      };
    }

    return { allowed: true };
  }

  async checkBranchLimit(churchId: Types.ObjectId, currentBranchCount: number) {
    const sub = await this.getSubscription(churchId);

    // Legacy subscription docs created before branch limits were introduced
    // can be missing branchLimit (or have it stored as 0) - fall back to the
    // current plan's limit instead of silently allowing unlimited branches.
    const branchLimit =
      sub.branchLimit || (await this.getPlanBranchLimit(sub.plan));

    if (branchLimit === -1) {
      return { allowed: true };
    }

    // countActive() already returns the number of active branches, so when
    // it equals the limit there is no room for another one. Strictly greater
    // would let a church exceed the limit when branches were created while
    // the limit was higher (e.g. on a bigger plan).
    if (currentBranchCount >= branchLimit) {
      return {
        allowed: false,
        message: `You're using ${currentBranchCount} of ${branchLimit} branches. Deactivate a branch or upgrade to add more.`,
      };
    }

    return { allowed: true };
  }

  async canUseCustomRoles(churchId: Types.ObjectId) {
    const sub = await this.getSubscription(churchId);
    return sub.customRolesEnabled;
  }

  async getPaymentHistory(churchId: string) {
    return this.paymentService.getChurchPayments(churchId);
  }

  // Collapses to the most recently updated doc per church, then drops any subscription whose churchId no longer matches a real Church document (e.g. a deleted church). Without this, orphaned or duplicate subscription rows can push plan totals past the actual church count.
  private latestSubscriptionPerChurchStages(): PipelineStage[] {
    return [
      { $sort: { churchId: 1, updatedAt: -1 } },
      {
        $group: {
          _id: '$churchId',
          plan: { $first: '$plan' },
          status: { $first: '$status' },
        },
      },
      {
        $lookup: {
          from: 'churches',
          localField: '_id',
          foreignField: '_id',
          as: 'church',
        },
      },
      { $match: { church: { $ne: [] } } },
      { $project: { church: 0 } },
    ];
  }

  async getChurchIdsByPlan(plan: string) {
    const subs = await this.subscriptionModel.aggregate([
      ...this.latestSubscriptionPerChurchStages(),
      { $match: { plan } },
    ]);
    return subs.map((s) => s._id);
  }

  async getCurrentPlan(churchId: Types.ObjectId) {
    const subscription = await this.getSubscription(churchId);
    const planDetails = this.getPlans().find(
      (plan) => plan.type === subscription.plan,
    );

    return {
      ...planDetails,
      status: subscription.status,
      billingCycle: this.getBillingCycle(subscription),
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      gracePeriodEndDate: subscription.gracePeriodEndDate,
      isAutoRenew: subscription.isAutoRenew,
      memberLimit: subscription.memberLimit,
      userLimit: subscription.userLimit,
      customRolesEnabled: subscription.customRolesEnabled,
    };
  }

  async getPlanChangePreview(
    churchId: Types.ObjectId,
    plan: PlanType,
    billingCycle: BillingCycle,
  ) {
    const subscription = await this.getSubscription(churchId);
    const now = new Date();

    const isActivePaid =
      subscription.plan !== PlanType.STARTER &&
      subscription.status === SubscriptionStatus.ACTIVE;

    const isPlanChange = isActivePaid && subscription.plan !== plan;

    const remainingMs =
      isPlanChange && subscription.endDate && subscription.endDate > now
        ? subscription.endDate.getTime() - now.getTime()
        : 0;

    const newEndDate = new Date();
    if (billingCycle === BillingCycle.MONTHLY) {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    } else {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    }
    newEndDate.setTime(newEndDate.getTime() + remainingMs);

    return {
      currentPlan: subscription.plan,
      targetPlan: plan,
      isPlanChange,
      isUpgrade: isPlanChange
        ? this.planRank[plan] > this.planRank[subscription.plan]
        : null,
      remainingDays: Math.ceil(remainingMs / (1000 * 60 * 60 * 24)),
      requiredBillingCycle: isActivePaid
        ? this.getBillingCycle(subscription)
        : billingCycle,
      newEndDate,
      amount: this.getPlanAmount(plan, billingCycle),
    };
  }

  async getBillingOverview(churchId: Types.ObjectId) {
    const subscription = await this.getSubscription(churchId);

    return {
      plans: this.getPlans(),

      currentPlan: subscription.plan,
      subscriptionStatus: subscription.status,

      churchStatus: this.mapToChurchStatus(subscription),

      billingCycle: this.getBillingCycle(subscription),
    };
  }

  async getSubscriptionByPlan() {
    const subscriptionsByPlan = await this.subscriptionModel.aggregate([
      ...this.latestSubscriptionPerChurchStages(),
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 },
        },
      },
    ]);

    const churchesByPlan = {
      STARTER: 0,
      GROWTH: 0,
      ENTERPRISE: 0,
    };

    subscriptionsByPlan.forEach((item) => {
      churchesByPlan[item._id] = item.count;
    });

    const totalStarterPlans = churchesByPlan.STARTER;

    const totalActivePlans = await this.countActiveSubscriptions();
    const totalActiveGrowthPlans = await this.countActiveByPlan(
      PlanType.GROWTH,
    );

    return {
      totalStarterPlans,
      totalActivePlans,
      totalActiveGrowthPlans,
      churchesByPlan,
    };
  }

  getPlans() {
    const numberOfMonths = 12;
    const yearlyDiscountRate = 0.83;

    return Object.values(PlanType).map((plan) => ({
      type: plan,
      name: this.formatPlanName(plan),

      monthlyPrice: this.getPlanAmount(plan, BillingCycle.MONTHLY),

      yearlyPrice: Math.round(
        this.getPlanAmount(plan, BillingCycle.MONTHLY) *
          numberOfMonths *
          yearlyDiscountRate,
      ),

      features: this.getPlanFeatures(plan),

      popular: plan === PlanType.GROWTH,
    }));
  }

  private getPlanFeatures(plan: PlanType): string[] {
    switch (plan) {
      case PlanType.STARTER:
        return [
          'Small teams',
          'Membership management',
          'Up to 3 users',
          'Up to 100 members',
          'Attendance tracking',
        ];

      case PlanType.GROWTH:
        return [
          'Everything in Starter',
          'Up to 10 users',
          'Up to 500 members',
          'Custom roles & permissions',
        ];

      case PlanType.EXPANSION:
        return [
          'Everything in Growth',
          'Up to 25 users',
          'Up to 1,500 members',
        ];

      case PlanType.ENTERPRISE:
        return [
          'Everything in Expansion',
          'Priority support',
          'Unlimited users',
          'Advanced controls',
          'Unlimited members',
        ];

      default:
        return [];
    }
  }

  private formatPlanName(plan: PlanType) {
    return plan.charAt(0) + plan.slice(1).toLowerCase();
  }

  private mapToChurchStatus(subscription: Subscription) {
    if (subscription.status === SubscriptionStatus.TRIAL) {
      return SubscriptionStatus.TRIAL;
    }

    if (subscription.status === SubscriptionStatus.ACTIVE) {
      return SubscriptionStatus.ACTIVE;
    }

    const now = new Date();

    if (subscription.endDate && subscription.gracePeriodEndDate) {
      if (
        now > subscription.endDate &&
        now <= subscription.gracePeriodEndDate
      ) {
        return SubscriptionStatus.GRACE;
      }

      if (now > subscription.gracePeriodEndDate) {
        return SubscriptionStatus.EXPIRED;
      }
    }

    if (subscription.endDate && now > subscription.endDate) {
      return SubscriptionStatus.EXPIRED;
    }

    return SubscriptionStatus.ACTIVE;
  }

  getBillingCycle(subscription: Subscription): BillingCycle {
    const oneDayInMilliseconds = 1000 * 60 * 60 * 24;
    const threeHundredSixtyFiveDaysLimit = 365;
    const subDurationInDays =
      (subscription.endDate.getTime() - subscription.startDate.getTime()) /
      oneDayInMilliseconds;

    if (subDurationInDays >= threeHundredSixtyFiveDaysLimit) {
      return BillingCycle.YEARLY;
    }
    return BillingCycle.MONTHLY;
  }

  async countActiveSubscriptions() {
    const result = await this.subscriptionModel.aggregate([
      ...this.latestSubscriptionPerChurchStages(),
      { $match: { status: SubscriptionStatus.ACTIVE } },
      { $count: 'count' },
    ]);
    return result[0]?.count || 0;
  }

  async countByPlan(plan: string) {
    const result = await this.subscriptionModel.aggregate([
      ...this.latestSubscriptionPerChurchStages(),
      { $match: { plan } },
      { $count: 'count' },
    ]);
    return result[0]?.count || 0;
  }

  async countActiveByPlan(plan: string) {
    const result = await this.subscriptionModel.aggregate([
      ...this.latestSubscriptionPerChurchStages(),
      { $match: { plan, status: SubscriptionStatus.ACTIVE } },
      { $count: 'count' },
    ]);
    return result[0]?.count || 0;
  }

  async getCountsByPlan() {
    const result = await this.subscriptionModel.aggregate([
      ...this.latestSubscriptionPerChurchStages(),
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);

    const map: Record<string, number> = {};
    result.forEach((r) => {
      map[r._id] = r.count;
    });

    return map;
  }

  async countNewSubscriptionsByPlanBetween(from?: Date, to?: Date) {
    const match: any = {};
    if (from || to) {
      match.createdAt = {};
      if (from) {
        match.createdAt.$gte = from;
      }
      if (to) {
        match.createdAt.$lt = to;
      }
    }

    const res = await this.subscriptionModel.aggregate([
      { $match: match },
      { $group: { _id: '$plan', count: { $sum: 1 } } },
    ]);

    const map: Record<string, number> = {};
    res.forEach((r: any) => (map[r._id] = r.count));
    return map;
  }

  async countSubscriptionsByStatusBetween(from?: Date, to?: Date) {
    const match: any = {};
    if (from || to) {
      match.createdAt = {};
      if (from) {
        match.createdAt.$gte = from;
      }
      if (to) {
        match.createdAt.$lt = to;
      }
    }

    const res = await this.subscriptionModel.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const map: Record<string, number> = {};
    res.forEach((r: any) => (map[r._id] = r.count));
    return map;
  }

  async getDueSubscriptions(): Promise<Subscription[]> {
    const now = new Date();

    return this.subscriptionModel.find({
      status: SubscriptionStatus.ACTIVE,
      isAutoRenew: true,
      endDate: { $lte: now },
    });
  }

  async extendSubscription(data: {
    churchId: Types.ObjectId;
    billingCycle: BillingCycle;
  }): Promise<Subscription | null> {
    const subscription = await this.subscriptionModel.findOne({
      churchId: data.churchId,
    });

    if (!subscription) {
      return null;
    }

    const now = new Date();
    const currentEnd =
      subscription.endDate && subscription.endDate > now
        ? subscription.endDate
        : now;

    const newEnd = new Date(currentEnd);

    if (data.billingCycle === BillingCycle.MONTHLY) {
      newEnd.setMonth(newEnd.getMonth() + 1);
    } else {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    }

    subscription.startDate = subscription.startDate || now;
    subscription.endDate = newEnd;
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.gracePeriodEndDate = null;

    await subscription.save();

    return subscription;
  }

  async pauseSubscription(churchId: Types.ObjectId) {
    const subscription = await this.subscriptionModel.findOne({ churchId });
    if (subscription) {
      subscription.status = SubscriptionStatus.SUSPENDED;
      subscription.pausedAt = new Date();
      await subscription.save();

      await this.notificationService.createNotification(churchId, {
        title: 'Subscription Suspended',
        body: `Your ${subscription.plan} plan subscription has been suspended. Resume it to restore full access.`,
        type: NotificationType.SUBSCRIPTION,
      });
    }
  }

  async resumeSubscription(churchId: Types.ObjectId) {
    const subscription = await this.subscriptionModel.findOne({ churchId });
    if (subscription) {
      subscription.status = SubscriptionStatus.ACTIVE;
      subscription.pausedAt = null;
      await subscription.save();

      await this.notificationService.createNotification(churchId, {
        title: 'Subscription Resumed',
        body: `Your ${subscription.plan} plan subscription is active again.`,
        type: NotificationType.SUBSCRIPTION,
      });
    }
  }

  async getActiveSubscription(churchId: Types.ObjectId) {
    return await this.subscriptionModel
      .findOne({
        churchId,
        status: SubscriptionStatus.ACTIVE,
      })
      .lean();
  }

  async getPlanMemberLimit(plan: PlanType): Promise<number> {
    return this.planLimits[plan].members || 0;
  }

  async getPlanUserLimit(plan: PlanType): Promise<number> {
    return this.planLimits[plan].users || 0;
  }

  async getPlanBranchLimit(plan: PlanType): Promise<number> {
    return this.planLimits[plan].branches ?? 0;
  }

  async updateGracePeriod(churchId: Types.ObjectId, gracePeriodEndDate: Date) {
    return await this.subscriptionModel.findOneAndUpdate(
      { churchId, status: SubscriptionStatus.ACTIVE },
      { gracePeriodEndDate },
      { new: true },
    );
  }

  async getGracePeriodStatus(churchId: Types.ObjectId) {
    const subscription = await this.subscriptionModel
      .findOne({
        churchId,
        status: SubscriptionStatus.ACTIVE,
      })
      .lean();

    if (!subscription) {
      return { hasGracePeriod: false, gracePeriodEndDate: null };
    }

    return {
      hasGracePeriod: !!subscription.gracePeriodEndDate,
      gracePeriodEndDate: subscription.gracePeriodEndDate,
      isWithinGracePeriod: subscription.gracePeriodEndDate
        ? new Date() < subscription.gracePeriodEndDate
        : false,
    };
  }

  async getMemberLimitForChurch(churchId: Types.ObjectId): Promise<number> {
    const subscription = await this.subscriptionModel
      .findOne({
        churchId,
        status: SubscriptionStatus.ACTIVE,
      })
      .lean();

    if (!subscription) {
      return this.getPlanMemberLimit(PlanType.STARTER);
    }

    return this.getPlanMemberLimit(subscription.plan);
  }
}
