import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SubscriptionPlanCodes } from '../../schemas/subscription-plan-codes.schema';
import { BillingCycle } from '../../common/utils/enums.utils';

@Injectable()
export class SubscriptionPlanCodesService {
  constructor(
    @InjectModel(SubscriptionPlanCodes.name)
    private subscriptionPlanCodesModel: Model<SubscriptionPlanCodes>,
  ) {}

  async findPlanCode(billingCycle: BillingCycle) {
    return await this.subscriptionPlanCodesModel.findOne({
      billingCycle,
    });
  }

  async createPlanCode(billingCycle: BillingCycle, planCode: string) {
    return await this.subscriptionPlanCodesModel.create({
      billingCycle,
      planCode,
    });
  }
}
