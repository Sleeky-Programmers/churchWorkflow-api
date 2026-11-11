import { ChurchProduct } from '../../../common/utils/enums.utils';
import {
  TimerBillingCycle,
  TimerPlan,
} from '../../../schemas/timer-billing.schema';

/**
 * Plan rules (Product Plan, section 7), kept pure so they can be tested.
 * Prices are placeholders until the team confirms them; they are stored in
 * the database and editable by product admins.
 */
export const DEFAULT_PLANS: Record<
  TimerPlan,
  {
    name: string;
    monthlyPrice: number;
    yearlyPrice: number;
    userLimit: number;
    importLimit: number;
    branchLimit: number;
    customBranding: boolean;
  }
> = {
  [TimerPlan.FREE]: {
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    userLimit: 2,
    branchLimit: 1,
    importLimit: 1,
    customBranding: false,
  },
  [TimerPlan.CHURCH]: {
    name: 'Church',
    // Placeholder within the ₦2,000–₦3,000 range in the Product Plan.
    monthlyPrice: 2500,
    yearlyPrice: 25000,
    userLimit: 5,
    branchLimit: 5,
    importLimit: 30,
    customBranding: true,
  },
};

/** What a church gets right now. */
export type EffectivePlanKey = TimerPlan | 'CHURCH_WORKFLOW';

/** The parts of a Church Workflow subscription that say whether it's live. */
export interface ChurchWorkflowSubscription {
  status?: string | null;
  endDate?: Date | null;
  gracePeriodEndDate?: Date | null;
}

const CW_GRACE_DAYS = 7;

/**
 * Whether a Church Workflow trial or paid plan is running. Mirrors Church
 * Workflow's own rule: usable until the end date, then a 7-day grace.
 */
export function churchWorkflowLive(
  sub: ChurchWorkflowSubscription | null | undefined,
  now: Date,
): boolean {
  if (!sub || sub.status === 'SUSPENDED' || sub.status === 'EXPIRED') {
    return false;
  }
  if (!sub.endDate) {
    return true; // No end date: open-ended.
  }
  const graceEnd =
    sub.gracePeriodEndDate ??
    new Date(new Date(sub.endDate).getTime() + CW_GRACE_DAYS * 86_400_000);
  return now <= new Date(graceEnd);
}

export function effectivePlanKey(
  products: ChurchProduct[] | undefined,
  subscription: { currentPeriodEnd: Date } | null,
  now: Date,
  churchWorkflow: ChurchWorkflowSubscription | null = null,
): EffectivePlanKey {
  // Churches that came through Church Workflow: the timer is included
  // (section 8.1). Unchanged from before the Church Workflow link.
  if (!products?.length || !products.includes(ChurchProduct.SERVICE_TIMER)) {
    return 'CHURCH_WORKFLOW';
  }
  // Timer churches get it included while Church Workflow is running for
  // them: the trial they start from the timer, or a paid plan. The trial
  // every church gets at sign-up doesn't count until they start it.
  const started =
    products.includes(ChurchProduct.CHURCH_WORKFLOW) ||
    churchWorkflow?.status === 'ACTIVE';
  if (started && churchWorkflowLive(churchWorkflow, now)) {
    return 'CHURCH_WORKFLOW';
  }
  return subscription && subscription.currentPeriodEnd > now
    ? TimerPlan.CHURCH
    : TimerPlan.FREE;
}

/** Paying again extends from the later of now and the current end. */
export function extendPeriod(
  currentEnd: Date | null,
  cycle: TimerBillingCycle,
  now: Date,
): Date {
  const from = currentEnd && currentEnd > now ? currentEnd : now;
  const next = new Date(from);
  if (cycle === TimerBillingCycle.YEARLY) {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
  } else {
    next.setUTCMonth(next.getUTCMonth() + 1);
  }
  return next;
}

/** The display colour presets the free plan can use (same as the timer app). */
export const COLOUR_PRESETS = [
  {
    bg: '#0c1a4d',
    text: '#f6f4ee',
    accent: '#3f63e0',
    warn: '#e9b949',
    over: '#ff4545',
  },
  {
    bg: '#000000',
    text: '#ffffff',
    accent: '#4169e1',
    warn: '#f2c14e',
    over: '#ff3b3b',
  },
  {
    bg: '#f4f6fc',
    text: '#0c1a4d',
    accent: '#2f52d0',
    warn: '#b7791f',
    over: '#d01f1f',
  },
];

export function isPreset(colors: Record<string, string>) {
  return COLOUR_PRESETS.some((p) =>
    (Object.keys(p) as (keyof typeof p)[]).every(
      (k) => String(colors[k]).toLowerCase() === p[k],
    ),
  );
}
