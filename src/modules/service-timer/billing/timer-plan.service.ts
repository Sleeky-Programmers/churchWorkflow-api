import { Model, Types } from 'mongoose';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';

import { Church } from '../../../schemas/church.schema';
import {
  TimerBillingCycle,
  TimerPlan,
  TimerPlanConfig,
  TimerSubscription,
} from '../../../schemas/timer-billing.schema';
import {
  DEFAULT_PLANS,
  EffectivePlanKey,
  effectivePlanKey,
} from './timer-plans';

export interface ChurchPlan {
  key: EffectivePlanKey;
  name: string;
  /** Seats for timer users; null means Church Workflow's own limits apply. */
  userLimit: number | null;
  /** Successful smart imports a month (0 = unlimited). */
  importLimit: number;
  /** Branches, each with its own timer; null means Church Workflow's limits. */
  branchLimit: number | null;
  /** Own logo and colours; without it, presets and a "Service Timer" mark. */
  customBranding: boolean;
  showMark: boolean;
  periodEnd: Date | null;
}

/** Which plan a church is on, and what that allows. */
@Injectable()
export class TimerPlanService {
  constructor(
    @InjectModel(TimerPlanConfig.name)
    private configModel: Model<TimerPlanConfig>,
    @InjectModel(TimerSubscription.name)
    private subscriptionModel: Model<TimerSubscription>,
    @InjectModel(Church.name) private churchModel: Model<Church>,
    private config: ConfigService,
  ) {}

  /** A plan's config, created from the defaults the first time. */
  async getConfig(plan: TimerPlan) {
    return this.configModel
      .findOneAndUpdate(
        { plan },
        { $setOnInsert: { plan, ...DEFAULT_PLANS[plan] } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
      .lean();
  }

  async listConfigs() {
    return Promise.all(Object.values(TimerPlan).map((p) => this.getConfig(p)));
  }

  async updateConfig(
    plan: TimerPlan,
    patch: Partial<Omit<TimerPlanConfig, 'plan'>>,
    updatedBy: Types.ObjectId | null,
  ) {
    await this.getConfig(plan);
    return this.configModel
      .findOneAndUpdate(
        { plan },
        { $set: { ...patch, updatedBy } },
        { new: true },
      )
      .lean();
  }

  async setPaystackPlan(
    cycle: TimerBillingCycle,
    plan: { code: string; amount: number },
  ) {
    await this.getConfig(TimerPlan.CHURCH);
    await this.configModel.updateOne(
      { plan: TimerPlan.CHURCH },
      { $set: { [`paystackPlans.${cycle}`]: plan } },
    );
  }

  async subscriptionOf(churchId: Types.ObjectId) {
    return this.subscriptionModel.findOne({ churchId }).lean();
  }

  async planFor(churchId: Types.ObjectId): Promise<ChurchPlan> {
    const [church, sub] = await Promise.all([
      this.churchModel.findById(churchId).select('products').lean(),
      this.subscriptionOf(churchId),
    ]);
    const key = effectivePlanKey(church?.products, sub, new Date());

    if (key === 'CHURCH_WORKFLOW') {
      const fairUse = Number(
        this.config.get<string>('TIMER_IMPORT_FAIR_USE_LIMIT'),
      );
      return {
        key,
        name: 'Included in Church Workflow',
        userLimit: null,
        importLimit: Number.isFinite(fairUse) && fairUse >= 0 ? fairUse : 50,
        branchLimit: null,
        customBranding: true,
        showMark: false,
        periodEnd: null,
      };
    }

    const cfg = await this.getConfig(key);
    return {
      key,
      name: cfg.name,
      userLimit: cfg.userLimit,
      importLimit: cfg.importLimit,
      branchLimit: cfg.branchLimit ?? DEFAULT_PLANS[key].branchLimit,
      customBranding: cfg.customBranding,
      showMark: !cfg.customBranding,
      periodEnd:
        key === TimerPlan.CHURCH ? (sub?.currentPeriodEnd ?? null) : null,
    };
  }
}
