import { ReportPeriod } from '../../schemas/report-snapshot.schema';
import { ReportRange } from './reports.types';

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDateStr(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

function fmtDayYear(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function makeRange(start: Date, end: Date, label?: string): ReportRange {
  const s = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const e = new Date(
    Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return {
    start: s,
    end: e,
    startStr: toDateStr(s),
    endStr: toDateStr(e),
    label: label ?? `${fmtDay(s)} - ${fmtDayYear(e)}`,
  };
}

/** Weeks run Monday to Sunday, months run first to last day (UTC). */
export function rangeContaining(
  period: ReportPeriod,
  anchor: Date,
): ReportRange {
  if (period === ReportPeriod.WEEKLY) {
    const dayFromMonday = (anchor.getUTCDay() + 6) % 7;
    const start = new Date(
      Date.UTC(
        anchor.getUTCFullYear(),
        anchor.getUTCMonth(),
        anchor.getUTCDate() - dayFromMonday,
      ),
    );
    const end = new Date(start.getTime() + 6 * DAY_MS);
    return makeRange(start, end);
  }

  const start = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1),
  );
  const end = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  );
  const label = start.toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return makeRange(start, end, label);
}

export function previousPeriodRange(
  period: ReportPeriod,
  range: ReportRange,
): ReportRange {
  return rangeContaining(period, new Date(range.start.getTime() - DAY_MS));
}

/** The range of equal length immediately before a custom range. */
export function previousCustomRange(range: ReportRange): ReportRange {
  const days = Math.round(
    (range.end.getTime() - range.start.getTime()) / DAY_MS,
  );
  const end = new Date(range.start.getTime() - DAY_MS);
  const start = new Date(end.getTime() - days * DAY_MS);
  return makeRange(start, end);
}

/** Oldest first; the last entry is the period containing `now`. */
export function recentPeriods(
  period: ReportPeriod,
  count: number,
  now: Date = new Date(),
): ReportRange[] {
  const out: ReportRange[] = [rangeContaining(period, now)];
  while (out.length < count) {
    out.unshift(previousPeriodRange(period, out[0]));
  }
  return out;
}

export function isClosed(range: ReportRange, now: Date = new Date()): boolean {
  return range.end.getTime() < now.getTime();
}

export function enumerateDays(range: ReportRange): string[] {
  const days: string[] = [];
  for (let t = range.start.getTime(); t <= range.end.getTime(); t += DAY_MS) {
    days.push(toDateStr(new Date(t)));
  }
  return days;
}
