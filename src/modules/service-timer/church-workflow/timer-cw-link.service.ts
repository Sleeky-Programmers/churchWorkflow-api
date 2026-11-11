import { Model, Types } from 'mongoose';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';

import { ChurchProduct } from '../../../common/utils/enums.utils';
import { Branch } from '../../../schemas/branch.schema';
import { Church } from '../../../schemas/church.schema';
import { ServiceInstance } from '../../../schemas/service-instance.schema';
import { Subscription } from '../../../schemas/subscription.schema';
import { churchWorkflowLive } from '../billing/timer-plans';
import { serviceDateOf } from '../reports/timer-reports.service';
import type { TimerScope } from '../service-timer.service';

/** Church Workflow's trial length, as at sign-up. */
export const CW_TRIAL_DAYS = 7;

/**
 * Where a church stands with Church Workflow, from the timer's side:
 * - member: came through Church Workflow (the timer is included)
 * - available: timer-only, Church Workflow not tried yet
 * - trial / active: started from the timer, trial or paid plan running
 * - ended: started, but the trial or plan has run out
 */
export type ChurchWorkflowState =
  | 'member'
  | 'available'
  | 'trial'
  | 'active'
  | 'ended';

/**
 * The link to Church Workflow (Product Plan, section 8): one login, a
 * trial that starts the first time a timer church opens Church Workflow,
 * and Church Workflow's services feeding the timer.
 */
@Injectable()
export class TimerChurchWorkflowService {
  constructor(
    @InjectModel(Church.name) private churchModel: Model<Church>,
    @InjectModel(Branch.name) private branchModel: Model<Branch>,
    @InjectModel(Subscription.name)
    private cwSubscriptionModel: Model<Subscription>,
    @InjectModel(ServiceInstance.name)
    private instanceModel: Model<ServiceInstance>,
    private config: ConfigService,
  ) {}

  private get url() {
    return (this.config.get<string>('FRONTEND_URL') || '').replace(/\/$/, '');
  }

  async status(churchId: Types.ObjectId) {
    const [church, cw] = await Promise.all([
      this.churchModel.findById(churchId).select('products').lean(),
      this.cwSubscriptionModel
        .findOne({ churchId })
        .select('status endDate gracePeriodEndDate')
        .lean(),
    ]);
    const products = church?.products ?? [];
    const now = new Date();
    let state: ChurchWorkflowState;
    if (!products.length || !products.includes(ChurchProduct.SERVICE_TIMER)) {
      state = 'member';
    } else {
      const started =
        products.includes(ChurchProduct.CHURCH_WORKFLOW) ||
        cw?.status === 'ACTIVE';
      if (!started) state = 'available';
      else if (!churchWorkflowLive(cw, now)) state = 'ended';
      else state = cw?.status === 'ACTIVE' ? 'active' : 'trial';
    }
    return {
      state,
      trialDays: CW_TRIAL_DAYS,
      trialEndsAt: state === 'trial' ? (cw?.endDate ?? null) : null,
      url: this.url || null,
    };
  }

  /**
   * A timer church opening Church Workflow for the first time: its trial
   * starts now (the one made at sign-up has usually run out unused), and
   * the timer counts as included while it runs. Doing it again changes
   * nothing, and a church that has paid for Church Workflow keeps its plan.
   */
  async start(churchId: Types.ObjectId) {
    const current = await this.status(churchId);
    if (current.state !== 'available') {
      return current;
    }
    const end = new Date(Date.now() + CW_TRIAL_DAYS * 86_400_000);
    await this.cwSubscriptionModel.updateOne(
      { churchId, status: { $ne: 'ACTIVE' } },
      { $set: { status: 'TRIAL', endDate: end, gracePeriodEndDate: end } },
    );
    await this.churchModel.updateOne(
      { _id: churchId },
      { $addToSet: { products: ChurchProduct.CHURCH_WORKFLOW } },
    );
    return this.status(churchId);
  }

  /**
   * Church Workflow services for the next two weeks at this branch (and
   * church-wide ones), for loading into the timer.
   */
  async upcomingServices(scope: TimerScope, days = 14) {
    const [branch, church] = await Promise.all([
      this.branchModel.findById(scope.branchId).select('timeZone').lean(),
      this.churchModel.findById(scope.churchId).select('timeZone').lean(),
    ]);
    const today = serviceDateOf(
      Date.now(),
      branch?.timeZone || church?.timeZone,
    );
    const now = Date.now();
    const rows = await this.instanceModel
      .find({
        churchId: scope.churchId,
        branchId: { $in: [scope.branchId, null] },
        date: {
          $gte: new Date(now - 86_400_000),
          $lte: new Date(now + days * 86_400_000),
        },
      })
      .sort({ date: 1, startTime: 1 })
      .limit(40)
      .lean();
    return rows
      .map((s) => ({
        id: String(s._id),
        title: s.title || 'Service',
        // Instances are stored at midnight, server time (UTC in production).
        date: new Date(s.date).toISOString().slice(0, 10),
        startTime: /^\d{1,2}:\d{2}$/.test(s.startTime ?? '')
          ? s.startTime.padStart(5, '0')
          : null,
        endTime: s.endTime || null,
        location: s.location || null,
      }))
      .filter((s) => s.date >= today)
      .slice(0, 20);
  }
}
