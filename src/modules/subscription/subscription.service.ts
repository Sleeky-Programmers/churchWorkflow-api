import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Subscription } from '../../schemas/subscription.schema';
import { PaymentService } from '../payment/payment.service';
import {
  BillingCycle,
  MemberLimitType,
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

  async getSubscription(churchId: string) {
    const subscription = await this.subscriptionModel.findOne({
      churchId: new Types.ObjectId(churchId),
    });

    if (!subscription) {
      return this.initializeTrialPlan(churchId);
    }

    return subscription;
  }

  async initializeTrialPlan(churchId: string) {
    const limits = this.planLimits[PlanType.STARTER];
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

    const newSubscription = new this.subscriptionModel({
      churchId: new Types.ObjectId(churchId),
      plan: PlanType.STARTER,
      status: SubscriptionStatus.TRIAL,
      memberLimit: limits.members,
      userLimit: limits.users,
      customRolesEnabled: limits.customRoles,
      endDate: trialEndDate,
      gracePeriodEndDate: trialEndDate,
    });

    return newSubscription.save();
  }

  async updateSubscription(data: {
    churchId: string;
    plan: PlanType;
    billingCycle: BillingCycle;
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
        gracePeriodEndDate: null,
      },
      { new: true, upsert: true },
    );
  }

  async checkMemberLimit(churchId: string, currentMemberCount: number) {
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

  async checkUserLimit(churchId: string, currentUserCount: number) {
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

  async canUseCustomRoles(churchId: string) {
    const sub = await this.getSubscription(churchId);
    return sub.customRolesEnabled;
  }

  async getPaymentHistory(churchId: string) {
    return this.paymentService.getChurchPayments(churchId);
  }
}
