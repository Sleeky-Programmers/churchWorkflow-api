import { Types } from 'mongoose';

import { ModuleSections } from '../../common/utils/enums.utils';

export type MetricFormat = 'number' | 'currency' | 'percent';

export interface ReportMetric {
  key: string;
  label: string;
  value: number;
  format: MetricFormat;
  currency?: string;
  // Filled in when a comparison period is available.
  previous?: number | null;
  changePct?: number | null;
}

export interface ReportSeries {
  key: string;
  label: string;
  currency?: string;
  // `label` is an ISO date (YYYY-MM-DD).
  points: { label: string; value: number }[];
}

export interface ReportBreakdown {
  key: string;
  label: string;
  format: MetricFormat;
  currency?: string;
  items: { label: string; value: number }[];
}

export interface SectionResult {
  key: string;
  title: string;
  group: SectionGroup;
  metrics: ReportMetric[];
  series: ReportSeries[];
  breakdowns: ReportBreakdown[];
  notes: string[];
}

export type SectionGroup = 'people' | 'finance' | 'operations';

export interface SectionDef {
  key: string;
  title: string;
  group: SectionGroup;
  description: string;
  // Permission needed (VIEW) for the section to be available to a person.
  permission: ModuleSections;
}

export interface ReportRange {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  label: string;
}

/**
 * Who the numbers are about. branchIds = null means the whole church
 * (including records that predate branches).
 */
export interface ReportScope {
  churchId: Types.ObjectId;
  branchIds: Types.ObjectId[] | null;
  // Branch the snapshot is stored under: a branch id, null for the whole
  // Church, or undefined when the scope is a custom mix that is never stored.
  snapshotBranchId: Types.ObjectId | null | undefined;
  label: string;
}
