import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
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
import { PaystackTransaction, TimerPaystackClient } from './paystack-client';
import { TimerPlanService } from './timer-plan.service';
import { BranchService } from '../../branch/branch.service';
import { PaystackWebhookRegistry } from '../../paystack/paystack-webhook.registry';
import { DEFAULT_PLANS, extendPeriod } from './timer-plans';

/** Marks timer payments so Church Workflow's Paystack webhook leaves them alone. */
export const TIMER_PAYMENT_TYPE = 'service_timer_plan';

// An unfinished checkout older than this is treated as failed.
const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Paying for the Church plan with Paystack. A payment buys a month or a
 * year; paying again extends it. Payments are confirmed when the payer
 * comes back, by Paystack's webhook, or when the billing page is opened,
 * whichever is first, and are applied once.
 *
 * Auto-renew: when the payer asks for it, the first payment's card is put
 * on a Paystack subscription that first charges when the paid period ends.
 * Each renewal arrives as a webhook and extends the plan.
 */
@Injectable()
export class TimerBillingService implements OnModuleInit {
  private readonly logger = new Logger(TimerBillingService.name);

  onModuleInit() {
    this.webhooks.register((payload) => this.handleWebhook(payload));
  }

  constructor(
    @InjectModel(TimerPayment.name) private paymentModel: Model<TimerPayment>,
    @InjectModel(TimerSubscription.name)
    private subscriptionModel: Model<TimerSubscription>,
    @InjectModel(TimerImport.name) private importModel: Model<TimerImport>,
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    @InjectModel(Invite.name) private inviteModel: Model<Invite>,
    private plans: TimerPlanService,
    private paystack: TimerPaystackClient,
    private branchService: BranchService,
    private webhooks: PaystackWebhookRegistry,
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
    const [plan, free, church, seats, imports, payments, branches, sub] =
      await Promise.all([
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
        this.branchService.countActive(churchId),
        this.plans.subscriptionOf(churchId),
      ]);
    // Also shown once Church Workflow includes the timer, so a church that
    // Moved across can stop paying for the timer separately.
    const renewing = plan.key !== TimerPlan.FREE && !!sub?.autoRenew;
    const limits = (c: typeof free) => ({
      users: c.userLimit,
      imports: c.importLimit,
      branches: c.branchLimit ?? DEFAULT_PLANS[c.plan].branchLimit,
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
      usage: { seats, imports, branches },
      // While auto-renew is on, Paystack charges at period end, so paying
      // By hand is off until it's turned off.
      canPay: plan.key !== 'CHURCH_WORKFLOW' && !renewing,
      autoRenew: renewing
        ? { cycle: sub!.cycle, nextChargeAt: sub!.currentPeriodEnd }
        : null,
      payments: payments.map((p) => ({
        reference: p.reference,
        amount: p.amount,
        cycle: p.cycle,
        paidAt: p.paidAt,
        renewal: !!p.renewal,
      })),
    };
  }

  async checkout(
    admin: Admin,
    cycle: TimerBillingCycle,
    callbackUrl: string,
    autoRenew = false,
  ) {
    const churchId = admin.churchId as Types.ObjectId;
    const plan = await this.plans.planFor(churchId);
    if (plan.key === 'CHURCH_WORKFLOW') {
      throw new BadRequestException(
        'The Service Timer is included in your Church Workflow plan.',
      );
    }
    const sub = await this.plans.subscriptionOf(churchId);
    if (plan.key === TimerPlan.CHURCH && sub?.autoRenew) {
      throw new ConflictException(
        'Auto-renew is on, so your plan renews by itself. Turn it off first to pay another way.',
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
        autoRenew,
      },
    });
    await this.paymentModel.create({
      churchId,
      adminId: admin._id,
      reference,
      amount,
      cycle,
      autoRenew,
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
        if (payment.autoRenew) {
          await this.startAutoRenew(payment, tx, end).catch((err) =>
            this.logger.error(
              `Couldn't set up auto-renew for ${payment.reference}: ${err}`,
            ),
          );
        } else if (sub?.autoRenew) {
          // Paid by hand after a lapsed auto-renew: stop the old one.
          await this.cancelAutoRenew(payment.churchId).catch((err) =>
            this.logger.warn(`Couldn't stop old auto-renew: ${err}`),
          );
        }
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

  /** The Paystack plan to renew a cycle on at this price, made if needed. */
  private async planCodeFor(cycle: TimerBillingCycle, amount: number) {
    const cfg = await this.plans.getConfig(TimerPlan.CHURCH);
    const saved = cfg.paystackPlans?.[cycle];
    if (saved?.code && saved.amount === amount) {
      return saved.code;
    }
    const code = await this.paystack.createPlan({
      name: `Service Timer ${cfg.name} (${cycle})`,
      interval: cycle === TimerBillingCycle.YEARLY ? 'annually' : 'monthly',
      amountNaira: amount,
    });
    await this.plans.setPaystackPlan(cycle, { code, amount });
    return code;
  }

  // ------------------------------------------------- product admin: plans

  /** The plans as product admins edit them, with how many renew by themselves. */
  async adminPlans() {
    const [configs, renewing] = await Promise.all([
      this.plans.listConfigs(),
      this.subscriptionModel.aggregate<{ _id: TimerBillingCycle; n: number }>([
        { $match: { autoRenew: true } },
        { $group: { _id: '$cycle', n: { $sum: 1 } } },
      ]),
    ]);
    const count = (cycle: TimerBillingCycle) =>
      renewing.find((r) => r._id === cycle)?.n ?? 0;
    return configs.map((c) => ({
      plan: c.plan,
      name: c.name,
      monthlyPrice: c.monthlyPrice,
      yearlyPrice: c.yearlyPrice,
      userLimit: c.userLimit,
      importLimit: c.importLimit,
      branchLimit: c.branchLimit ?? DEFAULT_PLANS[c.plan].branchLimit,
      customBranding: c.customBranding,
      updatedAt: (c as { updatedAt?: Date }).updatedAt ?? null,
      autoRenewing:
        c.plan === TimerPlan.CHURCH
          ? {
              monthly: count(TimerBillingCycle.MONTHLY),
              yearly: count(TimerBillingCycle.YEARLY),
            }
          : null,
    }));
  }

  /**
   * Saves a plan's prices and limits. A new Church price is also set on the
   * Paystack plans in use, so churches on auto-renew pay it from their next
   * renewal, as with Church Workflow's own plans. If Paystack refuses, the
   * saved plan is dropped and the next checkout makes one at the new price.
   */
  async updateAdminPlan(
    plan: TimerPlan,
    patch: Partial<{
      name: string;
      monthlyPrice: number;
      yearlyPrice: number;
      userLimit: number;
      importLimit: number;
      branchLimit: number;
      customBranding: boolean;
    }>,
    updatedBy: Types.ObjectId | null,
  ) {
    if (plan === TimerPlan.FREE) {
      if (patch.monthlyPrice || patch.yearlyPrice) {
        throw new BadRequestException('The Free plan has no price.');
      }
    } else if (
      (patch.monthlyPrice !== undefined && patch.monthlyPrice <= 0) ||
      (patch.yearlyPrice !== undefined && patch.yearlyPrice <= 0)
    ) {
      throw new BadRequestException(
        'The Church plan needs a monthly and a yearly price above ₦0.',
      );
    }

    const before = await this.plans.getConfig(plan);
    await this.plans.updateConfig(plan, patch, updatedBy);

    let paystack: { cycle: TimerBillingCycle; updated: number; failed: number }[] =
      [];
    if (plan === TimerPlan.CHURCH) {
      const changed: [TimerBillingCycle, number][] = [];
      if (
        patch.monthlyPrice !== undefined &&
        patch.monthlyPrice !== before.monthlyPrice
      ) {
        changed.push([TimerBillingCycle.MONTHLY, patch.monthlyPrice]);
      }
      if (
        patch.yearlyPrice !== undefined &&
        patch.yearlyPrice !== before.yearlyPrice
      ) {
        changed.push([TimerBillingCycle.YEARLY, patch.yearlyPrice]);
      }
      paystack = await Promise.all(
        changed.map(([cycle, amount]) => this.repricePaystack(cycle, amount)),
      );
    }

    const plans = await this.adminPlans();
    return { ...plans.find((p) => p.plan === plan)!, paystack };
  }

  /** Every Paystack plan a cycle renews on: the saved one and any older ones still in use. */
  private async repricePaystack(cycle: TimerBillingCycle, amount: number) {
    const cfg = await this.plans.getConfig(TimerPlan.CHURCH);
    const saved = cfg.paystackPlans?.[cycle]?.code ?? null;
    const inUse: string[] = await this.subscriptionModel.distinct(
      'paystackPlanCode',
      { autoRenew: true, cycle, paystackPlanCode: { $ne: null } },
    );
    const codes = [...new Set([saved, ...inUse].filter(Boolean) as string[])];

    let updated = 0;
    let failed = 0;
    for (const code of codes) {
      try {
        await this.paystack.updatePlanAmount(code, amount);
        updated++;
        if (code === saved) {
          await this.plans.setPaystackPlan(cycle, { code, amount });
        }
      } catch (err) {
        failed++;
        this.logger.warn(
          `Service Timer: couldn't set Paystack plan ${code} to ₦${amount} (${
            (err as any)?.response?.data?.message ?? (err as Error).message
          })`,
        );
        if (code === saved) {
          await this.plans.clearPaystackPlan(cycle);
        }
      }
    }
    return { cycle, updated, failed };
  }

  /**
   * Puts the card from the first payment on a Paystack subscription that
   * first charges when the period just paid for ends.
   */
  private async startAutoRenew(
    payment: TimerPayment,
    tx: PaystackTransaction,
    periodEnd: Date,
  ) {
    const customer = tx.customer?.customer_code;
    const authorization = tx.authorization?.authorization_code;
    if (!customer || !authorization || tx.authorization?.reusable === false) {
      this.logger.warn(
        `Payment ${payment.reference} can't be renewed automatically (card not reusable).`,
      );
      return;
    }
    const previous = await this.subscriptionModel
      .findOne({ churchId: payment.churchId })
      .lean();
    // Don't leave an older subscription charging alongside the new one.
    if (previous?.paystackSubscriptionCode && previous.paystackEmailToken) {
      await this.paystack
        .disableSubscription(
          previous.paystackSubscriptionCode,
          previous.paystackEmailToken,
        )
        .catch(() => undefined);
    }
    const planCode = await this.planCodeFor(payment.cycle, payment.amount);
    // Saved before Paystack answers, so its subscription.create webhook,
    // Which can arrive first, finds this church.
    await this.subscriptionModel.updateOne(
      { churchId: payment.churchId },
      {
        $set: {
          autoRenew: true,
          paystackCustomerCode: customer,
          paystackPlanCode: planCode,
          paystackSubscriptionCode: null,
          paystackEmailToken: null,
        },
      },
    );
    const created = await this.paystack.createSubscription({
      customer,
      authorization,
      plan: planCode,
      startDate: periodEnd,
    });
    if (created.subscriptionCode) {
      const saved = await this.subscriptionModel.updateOne(
        { churchId: payment.churchId, autoRenew: true },
        {
          $set: {
            paystackSubscriptionCode: created.subscriptionCode,
            paystackEmailToken: created.emailToken ?? null,
          },
        },
      );
      // Turned off while Paystack was answering: cancel what it made.
      if (saved.matchedCount === 0 && created.emailToken) {
        await this.paystack
          .disableSubscription(created.subscriptionCode, created.emailToken)
          .catch(() => undefined);
      }
    }
  }

  /** Stops future renewals; the time already paid for is kept. */
  async cancelAutoRenew(churchId: Types.ObjectId) {
    const sub = await this.subscriptionModel.findOne({ churchId }).lean();
    if (!sub?.autoRenew) {
      return { autoRenew: false };
    }
    if (sub.paystackSubscriptionCode && sub.paystackEmailToken) {
      await this.paystack.disableSubscription(
        sub.paystackSubscriptionCode,
        sub.paystackEmailToken,
      );
    } else {
      // Paystack hasn't confirmed the subscription yet, so there's nothing
      // To cancel there. Remember the wish; the webhook below honours it.
      this.logger.warn(
        `Auto-renew turned off for ${churchId} before Paystack confirmed it.`,
      );
    }
    await this.subscriptionModel.updateOne(
      { churchId },
      { $set: { autoRenew: false } },
    );
    return { autoRenew: false };
  }

  /**
   * Timer events from the shared Paystack webhook (signature already
   * checked). Returns true for the timer's own events.
   */
  async handleWebhook(payload: { event: string; data: any }) {
    const { event, data } = payload ?? ({} as any);
    if (!data) {
      return false;
    }
    const planCode: string | null =
      data.plan?.plan_code ??
      (typeof data.plan === 'string' ? data.plan : null);
    const customerCode: string | null =
      data.customer?.customer_code ??
      (typeof data.customer === 'string' ? data.customer : null);

    switch (event) {
      case 'charge.success': {
        if (data.metadata?.type === TIMER_PAYMENT_TYPE) {
          // A checkout: apply it now in case the payer never comes back.
          const payment = await this.paymentModel.findOne({
            reference: data.reference,
          });
          if (payment) {
            await this.settle(payment);
          }
          return true;
        }
        if (!planCode || !(await this.isTimerPlan(planCode))) {
          return false;
        }
        const sub = await this.subscriptionFor(planCode, customerCode);
        if (!sub) {
          this.logger.warn(
            `Renewal ${data.reference} on a timer plan matched no church.`,
          );
          return true;
        }
        await this.applyRenewal(sub, data);
        return true;
      }

      case 'subscription.create': {
        if (!planCode || !(await this.isTimerPlan(planCode))) {
          return false;
        }
        const sub = await this.subscriptionFor(planCode, customerCode);
        if (!sub) {
          return true;
        }
        if (!sub.autoRenew) {
          // Turned off before Paystack confirmed it: cancel it now.
          if (data.subscription_code && data.email_token) {
            await this.paystack
              .disableSubscription(data.subscription_code, data.email_token)
              .catch(() => undefined);
          }
          return true;
        }
        await this.subscriptionModel.updateOne(
          { _id: sub._id },
          {
            $set: {
              paystackSubscriptionCode: data.subscription_code ?? null,
              paystackEmailToken: data.email_token ?? null,
            },
          },
        );
        return true;
      }

      case 'subscription.disable':
      case 'subscription.not_renew': {
        const code = data.subscription_code;
        if (!code) {
          return false;
        }
        const res = await this.subscriptionModel.updateOne(
          { paystackSubscriptionCode: code },
          { $set: { autoRenew: false } },
        );
        return (
          res.matchedCount > 0 ||
          (!!planCode && (await this.isTimerPlan(planCode)))
        );
      }

      default:
        return false;
    }
  }

  /**
   * The church a renewal belongs to. One person (one Paystack customer) can
   * run several timer churches, so the one renewing wins over any whose
   * auto-renew is off, then the most recently changed.
   */
  private async subscriptionFor(planCode: string, customerCode: string | null) {
    const q = {
      paystackPlanCode: planCode,
      paystackCustomerCode: customerCode,
    };
    return (
      (await this.subscriptionModel.findOne({ ...q, autoRenew: true })) ??
      (await this.subscriptionModel.findOne(q).sort({ updatedAt: -1 }))
    );
  }

  private async isTimerPlan(planCode: string) {
    const [cfg, inUse] = await Promise.all([
      this.plans.getConfig(TimerPlan.CHURCH),
      this.subscriptionModel.exists({ paystackPlanCode: planCode }),
    ]);
    return (
      !!inUse ||
      Object.values(cfg.paystackPlans ?? {}).some((p) => p?.code === planCode)
    );
  }

  /** A renewal charge: recorded once (by reference), then the plan extended. */
  private async applyRenewal(sub: TimerSubscription, data: any) {
    try {
      await this.paymentModel.create({
        churchId: sub.churchId,
        adminId: null,
        reference: data.reference,
        amount: Number(data.amount ?? 0) / 100,
        cycle: sub.cycle,
        status: TimerPaymentStatus.SUCCESS,
        paidAt: data.paid_at ? new Date(data.paid_at) : new Date(),
        renewal: true,
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        return; // Already applied (Paystack retries webhooks).
      }
      throw err;
    }
    const end = extendPeriod(sub.currentPeriodEnd, sub.cycle, new Date());
    await this.subscriptionModel.updateOne(
      { _id: sub._id },
      { $set: { plan: TimerPlan.CHURCH, currentPeriodEnd: end } },
    );
  }
}
