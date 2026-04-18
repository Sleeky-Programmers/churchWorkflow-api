import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subscription } from '../../schemas/subscription.schema';
import { PaymentService } from '../payment/payment.service';
import {
  BillingCycle,
  MemberLimitType,
  PaymentProvider,
  PlanType,
  SubscriptionStatus,
} from '../../common/utils/enums.utils';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectModel(Subscription.name)
    private subscriptionModel: Model<Subscription>,
    private paymentService: PaymentService,
  ) {}

  private readonly planLimits = {
    [PlanType.STARTER]: {
      members: 100,
      users: 3,
      customRoles: false,
    },
    [PlanType.GROWTH]: {
      members: 500,
      users: 10,
      customRoles: true,
    },
    [PlanType.EXPANSION]: {
      members: 1500,
      users: 25,
      customRoles: true,
    },
    [PlanType.ENTERPRISE]: {
      members: -1,
      users: -1,
      customRoles: true,
    },
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
    const subscription = await this.subscriptionModel.findOne({ churchId });

    if (!subscription) {
      return this.initializeTrialPlan(churchId);
    }

    return subscription;
  }

  async initializeTrialPlan(churchId: Types.ObjectId) {
    const limits = this.planLimits[PlanType.STARTER];
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    return this.subscriptionModel.create({
      churchId,
      plan: PlanType.STARTER,
      status: SubscriptionStatus.TRIAL,
      memberLimit: limits.members,
      userLimit: limits.users,
      customRolesEnabled: limits.customRoles,
      endDate: trialEndDate,
      gracePeriodEndDate: trialEndDate,
    });
  }

  async createTrialSubscription(churchId: Types.ObjectId) {
    const existing = await this.subscriptionModel.findOne({ churchId });

    if (existing) {
      return existing;
    }

    return this.initializeTrialPlan(churchId);
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
    };
  }) {
    const limits = this.planLimits[data.plan];
    const startDate = new Date();
    const endDate = new Date();

    if (data.billingCycle === BillingCycle.MONTHLY) {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    return this.subscriptionModel.findOneAndUpdate(
      { churchId: new Types.ObjectId(data.churchId) },
      {
        plan: data.plan,
        status: SubscriptionStatus.ACTIVE,
        memberLimit: limits.members,
        userLimit: limits.users,
        customRolesEnabled: limits.customRoles,
        startDate,
        endDate,
        isAutoRenew: data.autoRenew,
        gracePeriodEndDate: null,

        ...(data.providerData && {
          provider: {
            name: PaymentProvider.PAYSTACK,
            subscriptionCode: data.providerData.subscriptionCode,
            emailToken: data.providerData.emailToken,
            customerCode: data.providerData.customerCode,
          },
        }),
      },
      { new: true, upsert: true },
    );
  }

  async isActiveAutoRenewing(churchId: Types.ObjectId) {
    const subscription = await this.getSubscription(churchId);

    return (
      subscription?.isAutoRenew &&
      subscription?.provider?.subscriptionCode &&
      subscription?.status === SubscriptionStatus.ACTIVE
    );
  }

  async checkMemberLimit(churchId: Types.ObjectId, currentMemberCount: number) {
    const sub = await this.getSubscription(churchId);

    if (sub.memberLimit === -1) {
      return { allowed: true, type: MemberLimitType.NONE };
    }

    if (currentMemberCount >= sub.memberLimit) {
      return {
        allowed: false,
        message: `You've reached your ${sub.memberLimit} member limit. Upgrade to continue.`,
        type: MemberLimitType.BLOCK,
      };
    }

    if (currentMemberCount >= 0.8 * sub.memberLimit) {
      return {
        allowed: true,
        message: `You're close to your member limit (${currentMemberCount}/${sub.memberLimit}).`,
        type: MemberLimitType.WARNING,
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
        message: `You've reached your ${sub.userLimit} user limit. Upgrade to add more users.`,
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

  async getChurchIdsByPlan(plan: string) {
    const subs = await this.subscriptionModel
      .find({ plan })
      .select('churchId')
      .lean();
    return subs.map((s) => s.churchId);
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
private getPlans() {
  return Object.values(PlanType).map((plan) => ({
    type: plan,
    name: this.formatPlanName(plan),

    monthlyPrice: this.getPlanAmount(plan, BillingCycle.MONTHLY),

    yearlyPrice: Math.round(
      this.getPlanAmount(plan, BillingCycle.MONTHLY) * 12 * 0.83,
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
    return 'TRIAL';
  }

  if (subscription.status === SubscriptionStatus.ACTIVE) {
    return 'ACTIVE';
  }


  if (subscription.endDate && new Date() > subscription.endDate) {
    return 'EXPIRED';
  }

  return 'ACTIVE';
}

private getBillingCycle(subscription: Subscription): BillingCycle {
  const duration =
    (subscription.endDate.getTime() - subscription.startDate.getTime()) /
    (1000 * 60 * 60 * 24);

  return duration > 32
    ? BillingCycle.YEARLY
    : BillingCycle.MONTHLY;
}
}
