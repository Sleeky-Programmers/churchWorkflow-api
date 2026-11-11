import { Model, PipelineStage, Types } from 'mongoose';
import { lastValueFrom } from 'rxjs';

import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';

import {
  BillingCycle,
  MemberLimitType,
  NotificationType,
  PaymentProvider,
  PlanType,
  SubscriptionStatus,
} from '../../common/utils/enums.utils';
import { PlanPricing } from '../../schemas/plan-pricing.schema';
import { Subscription } from '../../schemas/subscription.schema';
import { AdminActivityLogService } from '../admin-activity-log/admin-activity-log.service';
import { NotificationService } from '../notification/notification.service';
import { PaymentService } from '../payment/payment.service';
import { SubscriptionPlanCodesService } from '../subscription-plan-codes/subscription-plan-codes.service';
import { UpdatePlanPricingDto } from './dto/update-plan-pricing.dto';
import { DEFAULT_PLAN_CONFIG, PlanConfigDefaults } from './plan-defaults';

export type LimitResource = 'member' | 'guest';

@Injectable()
export class SubscriptionService implements OnModuleInit {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
    @InjectModel(PlanPricing.name)
    private planPricingModel: Model<PlanPricing>,
    private paymentService: PaymentService,
    private adminActivityLogService: AdminActivityLogService,
    private notificationService: NotificationService,
    private subscriptionPlanCodesService: SubscriptionPlanCodesService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  private readonly logger = new Logger(SubscriptionService.name);

  // In-memory cache of the DB-backed plan pricing/details, warmed on
  // Module init and kept fresh by updatePlanPricing(). Reading it stays
  // Synchronous so existing call sites (many of them non-async) don't need
  // To change.
  private readonly planConfigCache = new Map<PlanType, PlanPricing>();

  // Seed values used only when a plan document is missing. Existing documents are
  // Moved to new values by scripts/migrate-pricing-guest-limits.script.ts.
  private readonly defaultPlanConfig: Record<PlanType, PlanConfigDefaults> =
    DEFAULT_PLAN_CONFIG;

  private readonly planRank: Record<PlanType, number> = {
    [PlanType.STARTER]: 0,
    [PlanType.GROWTH]: 1,
    [PlanType.EXPANSION]: 2,
    [PlanType.ENTERPRISE]: 3,
  };

  async onModuleInit() {
    await this.loadPlanConfigCache();
  }

  // Runs on every cold start, so plans load in parallel rather than one
  // Round trip after another.
  private async loadPlanConfigCache() {
    await Promise.all(
      Object.values(PlanType).map(async (plan) => {
        let doc = await this.planPricingModel.findOne({ plan });
        if (!doc) {
          doc = await this.planPricingModel.create({
            plan,
            ...this.defaultPlanConfig[plan],
          });
        }
        this.planConfigCache.set(plan, doc);
      }),
    );
  }

  private getPlanConfig(plan: PlanType): PlanPricing {
    return (
      this.planConfigCache.get(plan) ||
      this.planConfigCache.get(PlanType.STARTER)!
    );
  }

  private describePlanPricingChanges(
    before: PlanPricing,
    dto: UpdatePlanPricingDto,
  ): string {
    const changes: string[] = [];

    for (const key of Object.keys(dto) as (keyof UpdatePlanPricingDto)[]) {
      const newValue = dto[key];
      if (newValue === undefined) {
        continue;
      }

      const oldValue = (before as any)[key];
      const format = (value: unknown) => {
        return Array.isArray(value) ? `[${value.join(', ')}]` : String(value);
      };

      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push(`${key}: ${format(oldValue)} → ${format(newValue)}`);
      }
    }

    return changes.length > 0 ? changes.join('; ') : 'no field changes';
  }

  async updatePlanPricing(
    plan: PlanType,
    dto: UpdatePlanPricingDto,
    productAdminId: string,
  ) {
    const before = this.getPlanConfig(plan);
    const changeSummary = this.describePlanPricingChanges(before, dto);

    const updated = await this.planPricingModel.findOneAndUpdate(
      { plan },
      { $set: { ...dto, updatedBy: productAdminId } },
      { new: true },
    );

    if (!updated) {
      throw new NotFoundException(`Plan pricing not found for ${plan}`);
    }

    this.planConfigCache.set(plan, updated);

    // Push the new amounts onto the cached Paystack plan codes so live
    // Auto-renewals charge the new price; codes Paystack refuses are dropped
    // And lazily recreated at the next checkout.
    if (dto.monthlyPrice !== undefined || dto.yearlyPrice !== undefined) {
      await this.subscriptionPlanCodesService.syncPlanAmounts(plan, {
        [BillingCycle.MONTHLY]: updated.monthlyPrice,
        [BillingCycle.YEARLY]: updated.yearlyPrice,
      });
    }

    // Copy changed limits onto every subscription on this plan so they take
    // Effect now rather than at each church's next renewal.
    const limitKeys = [
      'memberLimit',
      'guestLimit',
      'userLimit',
      'branchLimit',
      'customRolesEnabled',
    ] as const;
    if (
      limitKeys.some((k) => {
        return dto[k] !== undefined;
      })
    ) {
      await this.subscriptionModel.updateMany(
        { plan },
        { $set: this.limitsFromPlan(updated) },
      );
    }

    await this.revalidatePricingPage();

    await this.adminActivityLogService.create({
      adminId: productAdminId as any,
      action: 'UPDATE_PLAN_PRICING',
      details: `Updated ${plan} plan pricing/details — ${changeSummary}`,
      plan: plan as any,
    } as any);

    return this.getPlans().find((p) => {
      return p.type === plan;
    });
  }

  /** The limit fields a subscription copies from its plan. */
  limitsFromPlan(
    config: Pick<
      PlanPricing,
      | 'memberLimit'
      | 'guestLimit'
      | 'userLimit'
      | 'branchLimit'
      | 'customRolesEnabled'
    >,
  ) {
    return {
      memberLimit: config.memberLimit,
      guestLimit: config.guestLimit ?? 0,
      userLimit: config.userLimit,
      branchLimit: config.branchLimit,
      customRolesEnabled: config.customRolesEnabled,
    };
  }

  /** Busts the marketing pricing page's ISR cache. Best effort: never throws. */
  async revalidatePricingPage() {
    const url = this.configService.get<string>('frontend.revalidatePricingUrl');
    if (!url) {
      return;
    }
    const secret = this.configService.get<string>('frontend.revalidateSecret');
    try {
      await lastValueFrom(
        this.httpService.post(
          url,
          {},
          {
            headers: secret ? { Authorization: `Bearer ${secret}` } : {},
            timeout: 5000,
          },
        ),
      );
    } catch (error: any) {
      this.logger.warn(`Pricing page revalidation failed: ${error?.message}`);
    }
  }

  isContactSalesPlan(plan: PlanType): boolean {
    return !!this.getPlanConfig(plan).contactSales;
  }

  getPlanAmount(plan: PlanType, billingCycle: BillingCycle): number {
    const config = this.getPlanConfig(plan);
    return billingCycle === BillingCycle.YEARLY
      ? config.yearlyPrice
      : config.monthlyPrice;
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
    const limits = this.getPlanConfig(PlanType.STARTER);
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    return this.subscriptionModel.findOneAndUpdate(
      { churchId },
      {
        $setOnInsert: {
          churchId,
          plan: PlanType.STARTER,
          status: SubscriptionStatus.TRIAL,
          ...this.limitsFromPlan(limits),
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

    const limits = this.getPlanConfig(data.plan);
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
        ...this.limitsFromPlan(limits),
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

  /**
   * Effective limit for a resource on this church's subscription. Legacy
   * subscription docs may have the field missing or stored as 0, so fall back
   * to the live plan value rather than blocking every add.
   */
  async getEffectiveLimit(
    churchId: Types.ObjectId,
    resource: LimitResource,
  ): Promise<{ limit: number; plan: PlanType }> {
    const sub = await this.getSubscription(churchId);
    const field = resource === 'member' ? 'memberLimit' : 'guestLimit';
    const stored = (sub as any)[field] as number | undefined;
    const limit = stored ? stored : this.getPlanConfig(sub.plan)[field] || 0;
    return { limit, plan: sub.plan };
  }

  /** The cheapest plan above `plan` that raises the given limit, if any. */
  getUpgradeSuggestion(plan: PlanType, resource: LimitResource) {
    const field = resource === 'member' ? 'memberLimit' : 'guestLimit';
    const current = this.getPlanConfig(plan)[field];
    const next = Object.values(PlanType)
      .filter((p) => {
        return this.planRank[p] > this.planRank[plan];
      })
      .sort((a, b) => {
        return this.planRank[a] - this.planRank[b];
      })
      .find((p) => {
        const value = this.getPlanConfig(p)[field];
        return value === -1 || value > current;
      });
    if (!next) {
      return null;
    }
    const config = this.getPlanConfig(next);
    return {
      plan: next,
      name: config.name,
      limit: config[field],
      contactSales: !!config.contactSales,
    };
  }

  buildLimitMessage(resource: LimitResource, limit: number, plan: PlanType) {
    const noun = resource === 'member' ? 'members' : 'guests';
    const upgrade = this.getUpgradeSuggestion(plan, resource);
    let next = 'Contact us to discuss a custom limit.';
    if (upgrade) {
      const amount =
        upgrade.limit === -1
          ? `unlimited ${noun}`
          : `${upgrade.limit.toLocaleString('en-US')} ${noun}`;
      next = upgrade.contactSales
        ? `Contact us about ${upgrade.name} for ${amount}.`
        : `Upgrade to ${upgrade.name} for ${amount}.`;
    }
    return `You've reached your plan's ${resource} limit (${limit.toLocaleString('en-US')} ${noun}). ${next}`;
  }

  async checkResourceLimit(
    churchId: Types.ObjectId,
    resource: LimitResource,
    projectedCount: number,
  ) {
    const { limit, plan } = await this.getEffectiveLimit(churchId, resource);

    if (limit === -1) {
      return { allowed: true, type: MemberLimitType.NONE, limit };
    }

    if (projectedCount > limit) {
      return {
        allowed: false,
        message: this.buildLimitMessage(resource, limit, plan),
        type: MemberLimitType.BLOCK,
        limit,
        upgrade: this.getUpgradeSuggestion(plan, resource),
      };
    }

    return { allowed: true, type: MemberLimitType.NONE, limit };
  }

  async checkMemberLimit(churchId: Types.ObjectId, projectedCount: number) {
    return this.checkResourceLimit(churchId, 'member', projectedCount);
  }

  async checkGuestLimit(churchId: Types.ObjectId, projectedCount: number) {
    return this.checkResourceLimit(churchId, 'guest', projectedCount);
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
    // Can be missing branchLimit (or have it stored as 0) - fall back to the
    // Current plan's limit instead of silently allowing unlimited branches.
    const branchLimit =
      sub.branchLimit || (await this.getPlanBranchLimit(sub.plan));

    if (branchLimit === -1) {
      return { allowed: true };
    }

    // CountActive() already returns the number of active branches, so when
    // It equals the limit there is no room for another one. Strictly greater
    // Would let a church exceed the limit when branches were created while
    // The limit was higher (e.g. on a bigger plan).
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
    return subs.map((s) => {
      return s._id;
    });
  }

  async getCurrentPlan(churchId: Types.ObjectId) {
    const subscription = await this.getSubscription(churchId);
    const planDetails = this.getPlans().find((plan) => {
      return plan.type === subscription.plan;
    });

    return {
      ...planDetails,
      status: subscription.status,
      billingCycle: this.getBillingCycle(subscription),
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      gracePeriodEndDate: subscription.gracePeriodEndDate,
      isAutoRenew: subscription.isAutoRenew,
      memberLimit: subscription.memberLimit,
      guestLimit: subscription.guestLimit,
      userLimit: subscription.userLimit,
      branchLimit: subscription.branchLimit,
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
      EXPANSION: 0,
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
    return Object.values(PlanType).map((plan) => {
      const config = this.getPlanConfig(plan);
      return {
        type: plan,
        name: config.name,
        monthlyPrice: config.monthlyPrice,
        yearlyPrice: config.yearlyPrice,
        features: config.features,
        popular: config.popular,
        memberLimit: config.memberLimit,
        guestLimit: config.guestLimit ?? 0,
        userLimit: config.userLimit,
        branchLimit: config.branchLimit,
        customRolesEnabled: config.customRolesEnabled,
        contactSales: !!config.contactSales,
      };
    });
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
    res.forEach((r: any) => {
      return (map[r._id] = r.count);
    });
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
    res.forEach((r: any) => {
      return (map[r._id] = r.count);
    });
    return map;
  }

  async getDueSubscriptions(): Promise<Subscription[]> {
    const now = new Date();

    // Bounded per run so one cron tick cannot exceed the function time limit;
    // Oldest-due first, and the remainder is picked up on the next tick.
    return this.subscriptionModel
      .find({
        status: SubscriptionStatus.ACTIVE,
        isAutoRenew: true,
        endDate: { $lte: now },
      })
      .sort({ endDate: 1 })
      .limit(50);
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
    Object.assign(
      subscription,
      this.limitsFromPlan(this.getPlanConfig(subscription.plan)),
    );
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
    return this.getPlanConfig(plan).memberLimit || 0;
  }

  async getPlanUserLimit(plan: PlanType): Promise<number> {
    return this.getPlanConfig(plan).userLimit || 0;
  }

  async getPlanGuestLimit(plan: PlanType): Promise<number> {
    return this.getPlanConfig(plan).guestLimit || 0;
  }

  async getPlanBranchLimit(plan: PlanType): Promise<number> {
    return this.getPlanConfig(plan).branchLimit ?? 0;
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
    return (await this.getEffectiveLimit(churchId, 'member')).limit;
  }

  async getGuestLimitForChurch(churchId: Types.ObjectId): Promise<number> {
    return (await this.getEffectiveLimit(churchId, 'guest')).limit;
  }
}
