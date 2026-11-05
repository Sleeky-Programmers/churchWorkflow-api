import { MembershipStatus } from '../../common/utils/enums.utils';

/**
 * Guest (VISITOR) rules from "Church Workflow — Pricing, Guest Limits and
 * Upload Changes". The attendance rule is deliberately NOT configurable by
 * churches: it is what stops real members being marked as guests to dodge the
 * member limit.
 */
export const FREQUENT_GUEST_MIN_SERVICES = 4;
export const FREQUENT_GUEST_WINDOW_DAYS = 60;

/** Church-configurable inactivity period before a guest is auto-archived. */
export const ARCHIVE_AFTER_DAYS_DEFAULT = 90;
export const ARCHIVE_AFTER_DAYS_MIN = 30;
export const ARCHIVE_AFTER_DAYS_MAX = 180;

/** Archived guests are permanently deleted this long after archiving. */
export const ARCHIVE_RETENTION_DAYS = 365;
/** The church is warned this many days before the deletion. */
export const ARCHIVE_DELETION_WARNING_DAYS = 30;

/** Statuses that count towards the member limit. A legacy null status counts as a member. */
export const MEMBER_STATUSES: MembershipStatus[] = [
  MembershipStatus.CONVERT,
  MembershipStatus.MEMBER,
  MembershipStatus.VOLUNTEER,
  MembershipStatus.WORKER,
  MembershipStatus.LEADER,
];

export function isGuestStatus(status?: string | null): boolean {
  return status === MembershipStatus.VISITOR;
}

/** "YYYY-MM-DD" for `daysAgo` days before now (UTC), matching Attendance.date. */
export function dayKeyDaysAgo(daysAgo: number, now = new Date()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
