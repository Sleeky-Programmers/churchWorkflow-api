import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubscriptionPlanCodes } from '../../schemas/subscription-plan-codes.schema';
import { BillingCycle, PlanType } from '../../common/utils/enums.utils';

@Injectable()
export class SubscriptionPlanCodesService {
  constructor(
    @InjectModel(SubscriptionPlanCodes.name)
    private subscriptionPlanCodesModel: Model<SubscriptionPlanCodes>,
  ) {}

  async findPlanCode(plan: PlanType, billingCycle: BillingCycle) {
    return await this.subscriptionPlanCodesModel.findOne({
      plan,
      billingCycle,
    });
  }

  async createPlanCode(
    plan: PlanType,
    billingCycle: BillingCycle,
    planCode: string,
  ) {
    return await this.subscriptionPlanCodesModel.create({
      plan,
      billingCycle,
      planCode,
    });
  }

  async deleteByPlan(plan: PlanType) {
    return await this.subscriptionPlanCodesModel.deleteMany({ plan });
  }
}
