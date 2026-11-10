import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { AdminInviteStatus } from '../../../common/utils/enums.utils';
import { Admin } from '../../../schemas/admin.schema';
import { Invite } from '../../../schemas/invite.schema';
import {
  TimerBillingCycle,
  TimerPayment,
  TimerPaymentStatus,
  TimerPlan,
  TimerSubscription,
} from '../../../schemas/timer-billing.schema';
import {
  TimerImport,
  TimerImportStatus,
} from '../../../schemas/timer-import.schema';
import { monthBounds } from '../import/program-extraction';
import { TimerPaystackClient } from './paystack-client';
import { TimerPlanService } from './timer-plan.service';
import { extendPeriod } from './timer-plans';

/** Marks timer payments so Church Workflow's Paystack webhook leaves them alone. */
export const TIMER_PAYMENT_TYPE = 'service_timer_plan';

// An unfinished checkout older than this is treated as failed.
const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Paying for the Church plan with Paystack. A payment buys a month or a
 * year; paying again extends it. There is no auto-renew in this version, so
 * no Paystack plans or webhooks are involved: payments are confirmed when
 * the payer comes back, and any left pending are re-checked whenever the
 * billing page is opened.
 */
@Injectable()
export class TimerBillingService {
  private readonly logger = new Logger(TimerBillingService.name);

  constructor(
    @InjectModel(TimerPayment.name) private paymentModel: Model<TimerPayment>,
    @InjectModel(TimerSubscription.name)
    private subscriptionModel: Model<TimerSubscription>,
    @InjectModel(TimerImport.name) private importModel: Model<TimerImport>,
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    @InjectModel(Invite.name) private inviteModel: Model<Invite>,
    private plans: TimerPlanService,
    private paystack: TimerPaystackClient,
  ) {}

  /** Seats used: accounts plus pending invites, as Church Workflow counts them. */
  async seatsUsed(churchId: Types.ObjectId) {
    const [admins, pending] = await Promise.all([
      this.adminModel.countDocuments({ churchId }),
      this.inviteModel.countDocuments({
        churchId,
        status: AdminInviteStatus.PENDING,
      }),
    ]);
    return admins + pending;
  }

  async overview(churchId: Types.ObjectId) {
    await this.reconcile(churchId);
    const { start } = monthBounds(new Date());
    const [plan, free, church, seats, imports, payments] = await Promise.all([
      this.plans.planFor(churchId),
      this.plans.getConfig(TimerPlan.FREE),
      this.plans.getConfig(TimerPlan.CHURCH),
      this.seatsUsed(churchId),
      this.importModel.countDocuments({
        churchId,
        status: TimerImportStatus.SUCCEEDED,
        createdAt: { $gte: start },
      }),
      this.paymentModel
        .find({ churchId, status: TimerPaymentStatus.SUCCESS })
        .sort({ paidAt: -1 })
        .limit(12)
        .lean(),
    ]);
    const limits = (c: typeof free) => ({
      users: c.userLimit,
      imports: c.importLimit,
      customBranding: c.customBranding,
    });
    return {
      plan,
      plans: {
        free: { name: free.name, ...limits(free) },
        church: {
          name: church.name,
          monthlyPrice: church.monthlyPrice,
          yearlyPrice: church.yearlyPrice,
          ...limits(church),
        },
      },
      usage: { seats, imports },
      canPay: plan.key !== 'CHURCH_WORKFLOW',
      payments: payments.map((p) => ({
        reference: p.reference,
        amount: p.amount,
        cycle: p.cycle,
        paidAt: p.paidAt,
      })),
    };
  }

  async checkout(admin: Admin, cycle: TimerBillingCycle, callbackUrl: string) {
    const churchId = admin.churchId as Types.ObjectId;
    const plan = await this.plans.planFor(churchId);
    if (plan.key === 'CHURCH_WORKFLOW') {
      throw new BadRequestException(
        'The Service Timer is included in your Church Workflow plan.',
      );
    }
    const cfg = await this.plans.getConfig(TimerPlan.CHURCH);
    const amount =
      cycle === TimerBillingCycle.YEARLY ? cfg.yearlyPrice : cfg.monthlyPrice;
    if (!(amount > 0)) {
      throw new ServiceUnavailableException(
        "The Church plan's price hasn't been set yet.",
      );
    }
    const { reference, authorizationUrl } = await this.paystack.initialize({
      email: admin.email,
      amountNaira: amount,
      callbackUrl,
      metadata: {
        type: TIMER_PAYMENT_TYPE,
        churchId: String(churchId),
        plan: TimerPlan.CHURCH,
        cycle,
      },
    });
    await this.paymentModel.create({
      churchId,
      adminId: admin._id,
      reference,
      amount,
      cycle,
    });
    return { reference, authorizationUrl };
  }

  /** Called when the payer comes back from Paystack. */
  async confirm(churchId: Types.ObjectId, reference: string) {
    const payment = await this.paymentModel.findOne({ churchId, reference });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    const status = await this.settle(payment);
    return { status, plan: await this.plans.planFor(churchId) };
  }

  /** Re-checks this church's unfinished payments (e.g. the tab was closed). */
  private async reconcile(churchId: Types.ObjectId) {
    const pending = await this.paymentModel
      .find({ churchId, status: TimerPaymentStatus.PENDING })
      .limit(5);
    for (const p of pending) {
      await this.settle(p).catch((err) =>
        this.logger.warn(`Couldn't check payment ${p.reference}: ${err}`),
      );
    }
  }

  /**
   * Asks Paystack how a payment went and applies it once. The pending →
   * success switch is atomic, so a double callback can't extend twice.
   */
  private async settle(payment: TimerPayment): Promise<TimerPaymentStatus> {
    if (payment.status !== TimerPaymentStatus.PENDING) {
      return payment.status;
    }
    const tx = await this.paystack.verify(payment.reference);

    if (
      tx?.status === 'success' &&
      tx.amount >= Math.round(payment.amount * 100)
    ) {
      const paidAt = tx.paid_at ? new Date(tx.paid_at) : new Date();
      const won = await this.paymentModel.updateOne(
        { _id: payment._id, status: TimerPaymentStatus.PENDING },
        { $set: { status: TimerPaymentStatus.SUCCESS, paidAt } },
      );
      if (won.modifiedCount === 1) {
        const sub = await this.subscriptionModel.findOne({
          churchId: payment.churchId,
        });
        const end = extendPeriod(
          sub?.currentPeriodEnd ?? null,
          payment.cycle,
          new Date(),
        );
        await this.subscriptionModel.updateOne(
          { churchId: payment.churchId },
          {
            $set: {
              plan: TimerPlan.CHURCH,
              cycle: payment.cycle,
              currentPeriodEnd: end,
            },
          },
          { upsert: true },
        );
      }
      return TimerPaymentStatus.SUCCESS;
    }

    const stale =
      Date.now() - new Date((payment as any).createdAt ?? 0).getTime() >
      ABANDON_AFTER_MS;
    if (tx?.status === 'failed' || stale) {
      await this.paymentModel.updateOne(
        { _id: payment._id, status: TimerPaymentStatus.PENDING },
        { $set: { status: TimerPaymentStatus.FAILED } },
      );
      return TimerPaymentStatus.FAILED;
    }
    return TimerPaymentStatus.PENDING;
  }
}
