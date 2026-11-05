/* eslint-disable no-console */
// Standalone one-off migration script - not wired into app bootstrap.
// Run with: npm run migrate:pricing-guest-limits -- --dry-run   (report only)
//           Npm run migrate:pricing-guest-limits                (apply)
//
// Moves the live database onto the plans in
// "Church Workflow — Pricing, Guest Limits and Upload Changes":
//   1. planpricings: new prices, limits, guestLimit, contactSales, features.
//   2. subscriptions: every church's stored limits refreshed from its plan
//      (memberLimit, guestLimit, branchLimit, userLimit, customRolesEnabled).
//      Dates, status and provider data are untouched, so paid churches pay the
//      New price at their next renewal.
//   3. Paystack: cached plan codes get the new amounts, so live auto-renewals
//      Renew at the new price.
//   4. memberpastoralsettings: archiveAfterDays = 90 where missing.
//   5. Report of churches now over a limit.
// Safe to run more than once. Restart running API instances afterwards: they
// Cache plan pricing in memory.
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { SchedulerRegistry } from '@nestjs/schedule';
import * as mongoose from 'mongoose';
import { Model, Types } from 'mongoose';

import { AppModule } from '../app.module';
import { BillingCycle, PlanType } from '../common/utils/enums.utils';
import { GuestRulesService } from '../modules/members/guest-rules.service';
import { ARCHIVE_AFTER_DAYS_DEFAULT } from '../modules/members/guest-rules.constants';
import { SubscriptionPlanCodesService } from '../modules/subscription-plan-codes/subscription-plan-codes.service';
import { DEFAULT_PLAN_CONFIG } from '../modules/subscription/plan-defaults';
import { SubscriptionService } from '../modules/subscription/subscription.service';
import { Branch } from '../schemas/branch.schema';
import { MemberPastoralSettings } from '../schemas/member-pastoral-settings.schema';
import { PlanPricing } from '../schemas/plan-pricing.schema';
import { Subscription } from '../schemas/subscription.schema';

const DRY_RUN = process.argv.includes('--dry-run');
const tag = DRY_RUN ? '[dry run] ' : '';

const LIMIT_FIELDS = [
  'memberLimit',
  'guestLimit',
  'branchLimit',
  'userLimit',
  'customRolesEnabled',
] as const;

const PLAN_FIELDS = [
  'name',
  'monthlyPrice',
  'yearlyPrice',
  ...LIMIT_FIELDS,
  'popular',
  'contactSales',
  'features',
] as const;

const fmt = (v: unknown) =>
  v === undefined ? '—' : Array.isArray(v) ? `[${v.length} items]` : String(v);

async function run() {
  // Keep the app's own schedulers from firing while the script runs.
  process.env.DISABLE_IN_PROCESS_CRON = 'true';

  // A dry run must not write: stop Mongoose building the new indexes or
  // Creating collections when the app boots. (A real run builds them, the
  // Same as deploying this code.)
  if (DRY_RUN) {
    mongoose.set('autoIndex', false);
    mongoose.set('autoCreate', false);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  // Stop the app's scheduled jobs (reminders, renewals...) straight away so
  // This script never does their work.
  for (const job of app.get(SchedulerRegistry).getCronJobs().values()) {
    job.stop();
  }
  for (const name of app.get(SchedulerRegistry).getIntervals()) {
    app.get(SchedulerRegistry).deleteInterval(name);
  }

  try {
    const planModel = app.get<Model<PlanPricing>>(
      getModelToken(PlanPricing.name),
    );
    const subscriptionModel = app.get<Model<Subscription>>(
      getModelToken(Subscription.name),
    );
    const settingsModel = app.get<Model<MemberPastoralSettings>>(
      getModelToken(MemberPastoralSettings.name),
    );
    const branchModel = app.get<Model<Branch>>(getModelToken(Branch.name));
    const planCodes = app.get(SubscriptionPlanCodesService);
    const guestRules = app.get(GuestRulesService);
    const subscriptionService = app.get(SubscriptionService);

    // ── 1. Plans ────────────────────────────────────────────────────────
    console.log(`\n${tag}1. Plans`);
    for (const plan of Object.values(PlanType)) {
      const target = DEFAULT_PLAN_CONFIG[plan];
      const current = (await planModel.findOne({ plan }).lean()) as any;
      const changes = PLAN_FIELDS.filter(
        (k) => JSON.stringify(current?.[k]) !== JSON.stringify(target[k]),
      );
      if (!changes.length) {
        console.log(`  ${plan}: already up to date`);
        continue;
      }
      for (const k of changes) {
        console.log(`  ${plan}.${k}: ${fmt(current?.[k])} → ${fmt(target[k])}`);
      }
      if (!DRY_RUN) {
        await planModel.updateOne(
          { plan },
          { $set: { ...target }, $setOnInsert: { plan } },
          { upsert: true },
        );
      }
    }

    // ── 2. Subscriptions ────────────────────────────────────────────────
    console.log(`\n${tag}2. Subscriptions`);
    const subs = await subscriptionModel.find().lean();
    let subsChanged = 0;
    for (const sub of subs as any[]) {
      const target = DEFAULT_PLAN_CONFIG[sub.plan as PlanType];
      if (!target) {
        console.warn(`  ${sub.churchId}: unknown plan "${sub.plan}", skipped`);
        continue;
      }
      const diff = LIMIT_FIELDS.filter((k) => sub[k] !== target[k]);
      if (!diff.length) {
        continue;
      }
      subsChanged += 1;
      console.log(
        `  church ${sub.churchId} (${sub.plan}, ${sub.status}): ` +
          diff.map((k) => `${k} ${fmt(sub[k])}→${fmt(target[k])}`).join(', '),
      );
      if (!DRY_RUN) {
        await subscriptionModel.updateOne(
          { _id: sub._id },
          {
            $set: {
              memberLimit: target.memberLimit,
              guestLimit: target.guestLimit,
              branchLimit: target.branchLimit,
              userLimit: target.userLimit,
              customRolesEnabled: target.customRolesEnabled,
            },
          },
        );
      }
    }
    console.log(
      `  ${DRY_RUN ? 'Would update' : 'Updated'} ${subsChanged} of ${subs.length} subscriptions`,
    );

    // ── 3. Paystack plan codes ──────────────────────────────────────────
    console.log(`\n${tag}3. Paystack plan codes`);
    for (const plan of Object.values(PlanType)) {
      const target = DEFAULT_PLAN_CONFIG[plan];
      const results = await planCodes.syncPlanAmounts(
        plan,
        {
          [BillingCycle.MONTHLY]: target.monthlyPrice,
          [BillingCycle.YEARLY]: target.yearlyPrice,
        },
        { dryRun: DRY_RUN },
      );
      for (const r of results) {
        console.log(
          `  ${r.plan} ${r.billingCycle} ${r.planCode} → ₦${r.amount}: ${DRY_RUN ? 'would update' : r.outcome}${r.error ? ` (${r.error})` : ''}`,
        );
      }
    }
    const activeAutoRenew = (subs as any[]).filter(
      (s) => s.isAutoRenew && s.provider?.subscriptionCode,
    );
    console.log(
      `  ${activeAutoRenew.length} subscription(s) auto-renew on Paystack; checking their live plans:`,
    );
    const live = await planCodes.syncPlansForSubscriptions(
      activeAutoRenew.map((s) => ({
        subscriptionCode: s.provider.subscriptionCode,
        plan: s.plan as PlanType,
      })),
      (plan, cycle) =>
        cycle === BillingCycle.YEARLY
          ? DEFAULT_PLAN_CONFIG[plan].yearlyPrice
          : DEFAULT_PLAN_CONFIG[plan].monthlyPrice,
      { dryRun: DRY_RUN },
    );
    for (const r of live) {
      console.log(
        `  ${r.subscriptionCode} → plan ${r.planCode ?? '?'} (${r.interval ?? '?'}): ` +
          `₦${r.currentAmount ?? '?'} → ₦${r.newAmount ?? '?'} ${r.outcome}${r.error ? ` (${r.error})` : ''}` +
          (r.mismatch
            ? `
      ⚠ ${r.mismatch}`
            : ''),
      );
    }

    // ── 4. Guest archive setting ────────────────────────────────────────
    console.log(`\n${tag}4. Guest archive period`);
    const missing = await settingsModel.countDocuments({
      archiveAfterDays: { $exists: false },
    });
    console.log(
      `  ${DRY_RUN ? 'Would set' : 'Setting'} archiveAfterDays=${ARCHIVE_AFTER_DAYS_DEFAULT} on ${missing} church setting(s)`,
    );
    if (!DRY_RUN && missing) {
      await settingsModel.updateMany(
        { archiveAfterDays: { $exists: false } },
        { $set: { archiveAfterDays: ARCHIVE_AFTER_DAYS_DEFAULT } },
      );
    }

    // ── 5. Churches over a new limit ────────────────────────────────────
    console.log(`\n5. Churches over a limit under the new plans`);
    let overCount = 0;
    for (const sub of subs as any[]) {
      const target = DEFAULT_PLAN_CONFIG[sub.plan as PlanType];
      if (!target) {
        continue;
      }
      const churchId = new Types.ObjectId(sub.churchId);
      const counts = await guestRules.getLimitCounts(churchId);
      const branches = await branchModel.countDocuments({
        churchId,
        isActive: true,
      });
      const over: string[] = [];
      const check = (label: string, used: number, limit: number) => {
        if (limit !== -1 && used > limit) {
          over.push(`${label} ${used}/${limit}`);
        }
      };
      check('members', counts.effectiveMembers, target.memberLimit);
      check('guests', counts.effectiveGuests, target.guestLimit);
      check('branches', branches, target.branchLimit);
      if (over.length) {
        overCount += 1;
        console.log(
          `  church ${sub.churchId} (${sub.plan}): ${over.join(', ')}`,
        );
      }
    }
    if (!overCount) {
      console.log('  none');
    } else {
      console.log(
        '  Over-limit churches keep what they have but cannot add more until they are back under the limit or upgrade.',
      );
    }

    if (!DRY_RUN) {
      await subscriptionService.revalidatePricingPage();
      console.log(
        '\nDone. Restart running API instances so they reload plan pricing.',
      );
    } else {
      console.log('\n[dry run] No changes were written.');
    }
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
