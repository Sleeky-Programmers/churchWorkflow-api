import { ModuleSections } from '../../common/utils/enums.utils';

export interface CatalogPage {
  path: string;
  label: string;
  // Section a person needs VIEW access to for the page to be suggested.
  section: ModuleSections | null;
}

export interface CatalogAction {
  key: string;
  label: string;
  verb: string;
  href: string;
  section: ModuleSections | null;
}

/**
 * The only pages that are tracked and suggested. Anything not listed here
 * (settings, auth, unknown paths) is ignored, which also keeps arbitrary
 * client-supplied strings out of the usage data.
 */
export const PAGE_CATALOG: CatalogPage[] = [
  {
    path: '/dashboard/attendance',
    label: 'Attendance',
    section: ModuleSections.ATTENDANCE,
  },
  {
    path: '/dashboard/finance',
    label: 'Finance',
    section: ModuleSections.GIVING_AND_EXPENSES,
  },
  {
    path: '/dashboard/finance/giving',
    label: 'Giving records',
    section: ModuleSections.GIVING_AND_EXPENSES,
  },
  {
    path: '/dashboard/finance/giving/new',
    label: 'New giving record',
    section: ModuleSections.GIVING_AND_EXPENSES,
  },
  {
    path: '/dashboard/finance/giving/reports',
    label: 'Giving reports',
    section: ModuleSections.GIVING_AND_EXPENSES,
  },
  {
    path: '/dashboard/membership/dashboard',
    label: 'Members dashboard',
    section: ModuleSections.MEMBERS,
  },
  {
    path: '/dashboard/membership/members',
    label: 'Members',
    section: ModuleSections.MEMBERS,
  },
  {
    path: '/dashboard/membership/attention-center',
    label: 'Attention Center',
    section: ModuleSections.MEMBERS,
  },
  {
    path: '/dashboard/birthdays',
    label: 'Birthdays',
    section: ModuleSections.MEMBERS,
  },
  {
    path: '/dashboard/events',
    label: 'Events & Reminders',
    section: ModuleSections.EVENTS,
  },
  {
    path: '/dashboard/departments',
    label: 'Departments',
    section: ModuleSections.DEPARTMENTS,
  },
  {
    path: '/dashboard/teams',
    label: 'Small Teams',
    section: ModuleSections.SMALL_TEAMS,
  },
  {
    path: '/dashboard/requests',
    label: 'Requests',
    section: ModuleSections.REQUESTS,
  },
  {
    path: '/dashboard/asset-management',
    label: 'Asset Management',
    section: ModuleSections.ASSETS,
  },
  { path: '/dashboard/reports', label: 'Reports', section: null },
  { path: '/dashboard/notification', label: 'Notifications', section: null },
];

export const ACTION_CATALOG: CatalogAction[] = [
  {
    key: 'attendance.mark',
    label: 'record attendance',
    verb: 'Record attendance',
    href: '/dashboard/attendance',
    section: ModuleSections.ATTENDANCE,
  },
  {
    key: 'giving.confirm',
    label: 'confirm giving',
    verb: 'Confirm giving',
    href: '/dashboard/finance/giving',
    section: ModuleSections.GIVING_AND_EXPENSES,
  },
  {
    key: 'expense.add',
    label: 'record expenses',
    verb: 'Record an expense',
    href: '/dashboard/finance',
    section: ModuleSections.GIVING_AND_EXPENSES,
  },
  {
    key: 'requisition.review',
    label: 'review requests',
    verb: 'Review requests',
    href: '/dashboard/requests',
    section: ModuleSections.REQUESTS,
  },
  {
    key: 'alert.resolve',
    label: 'follow up on members',
    verb: 'Follow up on members',
    href: '/dashboard/membership/attention-center',
    section: ModuleSections.MEMBERS,
  },
  {
    key: 'member.add',
    label: 'add members',
    verb: 'Add a member',
    href: '/dashboard/membership/members',
    section: ModuleSections.MEMBERS,
  },
  {
    key: 'asset.service',
    label: 'log asset services',
    verb: 'Log an asset service',
    href: '/dashboard/asset-management',
    section: ModuleSections.ASSETS,
  },
  {
    key: 'report.export',
    label: 'export reports',
    verb: 'Export a report',
    href: '/dashboard/reports',
    section: null,
  },
];

export function normalizePagePath(
  raw: string | undefined | null,
): string | null {
  if (!raw || typeof raw !== 'string') {
    return null;
  }

  const clean = raw.split('?')[0].split('#')[0].replace(/\/+$/, '');
  let best: CatalogPage | null = null;

  for (const page of PAGE_CATALOG) {
    if (clean === page.path || clean.startsWith(`${page.path}/`)) {
      if (!best || page.path.length > best.path.length) {
        best = page;
      }
    }
  }

  return best ? best.path : null;
}

export function findPage(path: string): CatalogPage | undefined {
  return PAGE_CATALOG.find((p) => {
    return p.path === path;
  });
}

export function findAction(key: string): CatalogAction | undefined {
  return ACTION_CATALOG.find((a) => {
    return a.key === key;
  });
}
