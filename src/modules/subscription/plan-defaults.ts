import { PlanType } from '../../common/utils/enums.utils';

export interface PlanConfigDefaults {
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  memberLimit: number;
  guestLimit: number;
  userLimit: number;
  branchLimit: number;
  customRolesEnabled: boolean;
  popular: boolean;
  contactSales: boolean;
}

/**
 * Member, guest, branch and user limits are shown on plan cards from the
 * numeric fields below, so `features` lists only what the limits don't say.
 *
 * Plan pricing per "Church Workflow — Pricing, Guest Limits and Upload Changes".
 * Prices in NGN. Yearly = 10 × monthly (~17% off). -1 = unlimited.
 *
 * Seeds missing plan documents at startup, and is the source of truth for
 * scripts/migrate-pricing-guest-limits.script.ts, which updates existing ones.
 */
export const DEFAULT_PLAN_CONFIG: Record<PlanType, PlanConfigDefaults> = {
  [PlanType.STARTER]: {
    name: 'Starter',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: ['Membership management', 'Attendance tracking', 'Small teams'],
    memberLimit: 100,
    guestLimit: 200,
    userLimit: 3,
    branchLimit: 1,
    customRolesEnabled: false,
    popular: false,
    contactSales: false,
  },
  [PlanType.GROWTH]: {
    name: 'Growth',
    monthlyPrice: 5000,
    yearlyPrice: 50000,
    features: [
      'Everything in Starter',
      'Multiple branches',
      'Custom roles & permissions',
    ],
    memberLimit: 500,
    guestLimit: 1500,
    userLimit: 10,
    branchLimit: 5,
    customRolesEnabled: true,
    popular: true,
    contactSales: false,
  },
  [PlanType.EXPANSION]: {
    name: 'Expansion',
    monthlyPrice: 10000,
    yearlyPrice: 100000,
    features: [
      'Everything in Growth',
      'Room for larger and multi-site churches',
    ],
    memberLimit: 1500,
    guestLimit: 6000,
    userLimit: 25,
    branchLimit: 25,
    customRolesEnabled: true,
    popular: false,
    contactSales: false,
  },
  [PlanType.ENTERPRISE]: {
    name: 'Enterprise',
    // "From" price: Enterprise is quoted and activated manually by Sleeky's team.
    monthlyPrice: 50000,
    yearlyPrice: 500000,
    features: [
      'Everything in Expansion',
      'Custom onboarding',
      'Priority support',
    ],
    memberLimit: -1,
    guestLimit: -1,
    userLimit: -1,
    branchLimit: -1,
    customRolesEnabled: true,
    popular: false,
    contactSales: true,
  },
};
