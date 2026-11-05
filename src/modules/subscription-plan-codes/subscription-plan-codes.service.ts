import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { lastValueFrom } from 'rxjs';
import { SubscriptionPlanCodes } from '../../schemas/subscription-plan-codes.schema';
import { BillingCycle, PlanType } from '../../common/utils/enums.utils';

export interface PlanAmountSyncResult {
  plan: PlanType;
  billingCycle: BillingCycle;
  planCode: string;
  amount: number;
  outcome: 'updated' | 'deleted' | 'skipped';
  error?: string;
}

@Injectable()
export class SubscriptionPlanCodesService {
  private readonly logger = new Logger(SubscriptionPlanCodesService.name);

  constructor(
    @InjectModel(SubscriptionPlanCodes.name)
    private subscriptionPlanCodesModel: Model<SubscriptionPlanCodes>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async findPlanCode(plan: PlanType, billingCycle: BillingCycle) {
    return await this.subscriptionPlanCodesModel.findOne({
      plan,
      billingCycle,
    });
  }

  async findAll() {
    return this.subscriptionPlanCodesModel.find().lean();
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

  /**
   * Pushes a new price onto the Paystack plan objects already cached for `plan`, so
   * live auto-renewing subscriptions on those plan codes renew at the new price
   * (Paystack applies plan amount changes to existing subscriptions unless
   * `update_existing_subscriptions` is false). If Paystack refuses an update, that
   * cached code is dropped so the next checkout lazily creates a fresh plan code at
   * the new price (the previous behaviour).
   *
   * `amounts` are in naira (whole units), keyed by billing cycle.
   */
  async syncPlanAmounts(
    plan: PlanType,
    amounts: Record<BillingCycle, number>,
    options: { dryRun?: boolean } = {},
  ): Promise<PlanAmountSyncResult[]> {
    const codes = await this.subscriptionPlanCodesModel.find({ plan }).lean();
    const secretKey = this.configService.get<string>('paystack.secretKey');
    const baseUrl = this.configService.get<string>('paystack.baseUrl');
    const results: PlanAmountSyncResult[] = [];

    for (const code of codes) {
      const billingCycle = code.billingCycle as BillingCycle;
      const amount = amounts[billingCycle];
      const base = {
        plan,
        billingCycle,
        planCode: code.planCode,
        amount,
      };

      if (options.dryRun) {
        results.push({ ...base, outcome: 'skipped' });
        continue;
      }

      // A free plan (or missing config) can't be a Paystack plan — drop the stale code.
      if (!amount || amount <= 0 || !secretKey || !baseUrl) {
        await this.subscriptionPlanCodesModel.deleteOne({ _id: code._id });
        results.push({
          ...base,
          outcome: 'deleted',
          error: !amount ? 'amount is 0' : 'Paystack not configured',
        });
        continue;
      }

      try {
        await lastValueFrom(
          this.httpService.put(
            `${baseUrl}/plan/${code.planCode}`,
            {
              amount: Math.round(amount * 100),
              update_existing_subscriptions: true,
            },
            {
              headers: {
                Authorization: `Bearer ${secretKey}`,
                'Content-Type': 'application/json',
              },
            },
          ),
        );
        results.push({ ...base, outcome: 'updated' });
      } catch (error: any) {
        const message = error?.response?.data?.message || error?.message;
        this.logger.warn(
          `Paystack plan ${code.planCode} update failed (${message}); dropping cached code`,
        );
        await this.subscriptionPlanCodesModel.deleteOne({ _id: code._id });
        results.push({ ...base, outcome: 'deleted', error: message });
      }
    }

    return results;
  }

  /**
   * Live Paystack subscriptions may sit on plan objects that are not in the
   * local cache (codes are dropped when pricing changes). This looks up each
   * subscription's actual plan on Paystack and sets that plan's amount, so
   * its next renewal charges the new price. Plans shared by several
   * subscriptions are updated once.
   */
  async syncPlansForSubscriptions(
    subscriptions: { subscriptionCode: string; plan: PlanType }[],
    amountFor: (plan: PlanType, cycle: BillingCycle) => number,
    options: { dryRun?: boolean } = {},
  ): Promise<
    {
      subscriptionCode: string;
      planCode?: string;
      interval?: string;
      currentAmount?: number;
      newAmount?: number;
      outcome:
        | 'updated'
        | 'would update'
        | 'unchanged'
        | 'shared plan, handled above'
        | 'failed';
      error?: string;
      paystackTier?: PlanType;
      mismatch?: string;
    }[]
  > {
    const secretKey = this.configService.get<string>('paystack.secretKey');
    const baseUrl = this.configService.get<string>('paystack.baseUrl');
    const headers = {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    };
    const done = new Set<string>();
    const results: any[] = [];

    for (const sub of subscriptions) {
      try {
        const res = await lastValueFrom(
          this.httpService.get(
            `${baseUrl}/subscription/${sub.subscriptionCode}`,
            {
              headers,
            },
          ),
        );
        const planObj = res.data?.data?.plan;
        const planCode: string | undefined = planObj?.plan_code;
        const interval: string | undefined = planObj?.interval;
        const cycle =
          interval === 'annually' ? BillingCycle.YEARLY : BillingCycle.MONTHLY;
        // Paystack plans are created named after our plan type. A plan is
        // Shared by every church that bought that tier, so its price follows
        // Its own tier, not the church's current (possibly overridden) plan.
        const paystackTier = Object.values(PlanType).includes(planObj?.name)
          ? (planObj.name as PlanType)
          : sub.plan;
        const newAmount = amountFor(paystackTier, cycle);
        const currentAmount =
          typeof planObj?.amount === 'number'
            ? planObj.amount / 100
            : undefined;
        const base = {
          subscriptionCode: sub.subscriptionCode,
          planCode,
          interval,
          currentAmount,
          newAmount,
          paystackTier,
          mismatch:
            paystackTier !== sub.plan
              ? `church is on ${sub.plan} but renews on the ${paystackTier} Paystack plan`
              : undefined,
        };

        if (!planCode) {
          results.push({
            ...base,
            outcome: 'failed',
            error: 'no plan on subscription',
          });
          continue;
        }
        if (done.has(planCode)) {
          results.push({ ...base, outcome: 'shared plan, handled above' });
          continue;
        }
        if (currentAmount === newAmount) {
          results.push({ ...base, outcome: 'unchanged' });
          continue;
        }
        if (options.dryRun) {
          done.add(planCode);
          results.push({ ...base, outcome: 'would update' });
          continue;
        }
        await lastValueFrom(
          this.httpService.put(
            `${baseUrl}/plan/${planCode}`,
            {
              amount: Math.round(newAmount * 100),
              update_existing_subscriptions: true,
            },
            { headers },
          ),
        );
        done.add(planCode);
        results.push({ ...base, outcome: 'updated' });
      } catch (error: any) {
        results.push({
          subscriptionCode: sub.subscriptionCode,
          outcome: 'failed',
          error: error?.response?.data?.message || error?.message,
        });
      }
    }
    return results;
  }
}
