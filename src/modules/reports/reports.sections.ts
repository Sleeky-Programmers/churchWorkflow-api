import { Model } from 'mongoose';

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import {
  AssetStatus,
  AttendanceStatus,
  DepartmentStatus,
  ModuleSections,
  RequisitionStatus,
  SmallTeamStatus,
} from '../../common/utils/enums.utils';
import { Asset } from '../../schemas/asset.schema';
import { Attendance } from '../../schemas/attendance.schema';
import { Department } from '../../schemas/department.schema';
import { Expense } from '../../schemas/expense.schema';
import { GivingBatch } from '../../schemas/giving-batch.schema';
import { GivingEntry } from '../../schemas/giving-entry.schema';
import { Member } from '../../schemas/member.schema';
import { OfferingType } from '../../schemas/offering-type.schema';
import { PastoralAlert } from '../../schemas/pastoral-alert.schema';
import { Requisition } from '../../schemas/requisition.schema';
import { ServiceInstance } from '../../schemas/service-instance.schema';
import { SmallTeam } from '../../schemas/small-team.schema';
import { enumerateDays, toDateStr } from './reports.periods';
import {
  MetricFormat,
  ReportBreakdown,
  ReportMetric,
  ReportRange,
  ReportScope,
  ReportSeries,
  SectionDef,
  SectionResult,
} from './reports.types';

/**
 * Every section a report can contain. The order here is the order shown in
 * the report. To add a section, add a definition here and a matching method
 * in ReportSectionsService.
 */
export const SECTION_DEFS: SectionDef[] = [
  {
    key: 'attendance',
    title: 'Attendance',
    group: 'people',
    description: 'Who showed up, how often and how services are trending.',
    permission: ModuleSections.ATTENDANCE,
  },
  {
    key: 'members',
    title: 'Members',
    group: 'people',
    description: 'Membership size, new members and first-time visitors.',
    permission: ModuleSections.MEMBERS,
  },
  {
    key: 'attention',
    title: 'Attention Center',
    group: 'people',
    description: 'Pastoral alerts raised, followed up and still open.',
    permission: ModuleSections.MEMBERS,
  },
  {
    key: 'giving',
    title: 'Giving',
    group: 'finance',
    description: 'Giving received, by offering type and payment method.',
    permission: ModuleSections.GIVING_AND_EXPENSES,
  },
  {
    key: 'expenses',
    title: 'Expenses',
    group: 'finance',
    description: 'Money spent and where it went.',
    permission: ModuleSections.GIVING_AND_EXPENSES,
  },
  {
    key: 'requests',
    title: 'Requests',
    group: 'operations',
    description: 'Requisitions submitted, approved, declined and waiting.',
    permission: ModuleSections.REQUESTS,
  },
  {
    key: 'events',
    title: 'Events & Services',
    group: 'operations',
    description: 'Services and events held in the period.',
    permission: ModuleSections.EVENTS,
  },
  {
    key: 'departments',
    title: 'Departments',
    group: 'operations',
    description: 'Department activity and size.',
    permission: ModuleSections.DEPARTMENTS,
  },
  {
    key: 'teams',
    title: 'Small Teams',
    group: 'people',
    description: 'Small team growth and participation.',
    permission: ModuleSections.SMALL_TEAMS,
  },
  {
    key: 'assets',
    title: 'Assets',
    group: 'operations',
    description: 'Asset register, services logged and maintenance due.',
    permission: ModuleSections.ASSETS,
  },
];

export const SECTION_KEYS = SECTION_DEFS.map((d) => {
  return d.key;
});

const TOP_CURRENCIES = 3;

function metric(
  key: string,
  label: string,
  value: number,
  format: MetricFormat = 'number',
  currency?: string,
): ReportMetric {
  return {
    key,
    label,
    value: Math.round((value || 0) * 100) / 100,
    format,
    ...(currency ? { currency } : {}),
  };
}

function seriesFromMap(
  key: string,
  label: string,
  range: ReportRange,
  byDate: Map<string, number>,
  currency?: string,
): ReportSeries {
  return {
    key,
    label,
    ...(currency ? { currency } : {}),
    points: enumerateDays(range).map((day) => {
      return {
        label: day,
        value: Math.round((byDate.get(day) ?? 0) * 100) / 100,
      };
    }),
  };
}

function topEntries<T>(
  map: Map<string, T>,
  score: (v: T) => number,
  n: number,
) {
  return [...map.entries()]
    .sort((a, b) => {
      return score(b[1]) - score(a[1]);
    })
    .slice(0, n);
}

function breakdown(
  key: string,
  label: string,
  map: Map<string, number>,
  format: MetricFormat = 'number',
  currency?: string,
  limit = 8,
): ReportBreakdown {
  return {
    key,
    label,
    format,
    ...(currency ? { currency } : {}),
    items: topEntries(
      map,
      (v) => {
        return v;
      },
      limit,
    ).map(([name, value]) => {
      return {
        label: name,
        value: Math.round(value * 100) / 100,
      };
    }),
  };
}

@Injectable()
export class ReportSectionsService {
  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @InjectModel(Member.name) private memberModel: Model<Member>,
    @InjectModel(PastoralAlert.name)
    private alertModel: Model<PastoralAlert>,
    @InjectModel(GivingBatch.name) private batchModel: Model<GivingBatch>,
    @InjectModel(GivingEntry.name) private entryModel: Model<GivingEntry>,
    @InjectModel(OfferingType.name)
    private offeringTypeModel: Model<OfferingType>,
    @InjectModel(Expense.name) private expenseModel: Model<Expense>,
    @InjectModel(Requisition.name) private requisitionModel: Model<Requisition>,
    @InjectModel(ServiceInstance.name)
    private serviceInstanceModel: Model<ServiceInstance>,
    @InjectModel(Department.name) private departmentModel: Model<Department>,
    @InjectModel(SmallTeam.name) private smallTeamModel: Model<SmallTeam>,
    @InjectModel(Asset.name) private assetModel: Model<Asset>,
  ) {}

  async computeAll(
    scope: ReportScope,
    range: ReportRange,
    keys: string[] = SECTION_KEYS,
  ): Promise<Record<string, SectionResult>> {
    const entries = await Promise.all(
      keys.map(async (key) => {
        return [key, await this.compute(key, scope, range)] as const;
      }),
    );
    return Object.fromEntries(entries);
  }

  compute(key: string, scope: ReportScope, range: ReportRange) {
    switch (key) {
      case 'attendance':
        return this.attendance(scope, range);
      case 'members':
        return this.members(scope, range);
      case 'attention':
        return this.attention(scope, range);
      case 'giving':
        return this.giving(scope, range);
      case 'expenses':
        return this.expenses(scope, range);
      case 'requests':
        return this.requests(scope, range);
      case 'events':
        return this.events(scope, range);
      case 'departments':
        return this.departments(scope, range);
      case 'teams':
        return this.teams(scope, range);
      case 'assets':
        return this.assets(scope, range);
      default:
        throw new Error(`Unknown report section: ${key}`);
    }
  }

  private base(scope: ReportScope): Record<string, unknown> {
    return {
      churchId: scope.churchId,
      ...(scope.branchIds ? { branchId: { $in: scope.branchIds } } : {}),
    };
  }

  private shell(key: string): SectionResult {
    const def = SECTION_DEFS.find((d) => {
      return d.key === key;
    })!;
    return {
      key,
      title: def.title,
      group: def.group,
      metrics: [],
      series: [],
      breakdowns: [],
      notes: [],
    };
  }

  // ------------------------------------------------------------------
  // People
  // ------------------------------------------------------------------

  private async attendance(scope: ReportScope, range: ReportRange) {
    const out = this.shell('attendance');
    const match = {
      ...this.base(scope),
      date: { $gte: range.startStr, $lte: range.endStr },
    };

    const [rows, unique] = await Promise.all([
      this.attendanceModel.aggregate([
        { $match: match },
        {
          $group: {
            _id: { date: '$date', svc: '$churchServiceId', status: '$status' },
            n: { $sum: 1 },
          },
        },
      ]),
      this.attendanceModel.aggregate([
        { $match: { ...match, status: AttendanceStatus.PRESENT } },
        { $group: { _id: '$memberId' } },
        { $count: 'n' },
      ]),
    ]);

    let present = 0;
    let absent = 0;
    const sessions = new Set<string>();
    const presentByDate = new Map<string, number>();

    for (const row of rows) {
      if (row._id.status === AttendanceStatus.PRESENT) {
        present += row.n;
        sessions.add(`${row._id.date}|${row._id.svc}`);
        presentByDate.set(
          row._id.date,
          (presentByDate.get(row._id.date) ?? 0) + row.n,
        );
      } else {
        absent += row.n;
      }
    }

    const marked = present + absent;
    out.metrics.push(
      metric('attendance_present', 'People present', present),
      metric('attendance_sessions', 'Services recorded', sessions.size),
      metric(
        'attendance_average',
        'Average per service',
        sessions.size ? present / sessions.size : 0,
      ),
      metric(
        'attendance_unique',
        'Different people attending',
        unique[0]?.n ?? 0,
      ),
      metric(
        'attendance_rate',
        'Attendance rate',
        marked ? (present / marked) * 100 : 0,
        'percent',
      ),
    );
    out.series.push(
      seriesFromMap(
        'attendance_by_day',
        'People present',
        range,
        presentByDate,
      ),
    );
    if (!sessions.size) {
      out.notes.push('No attendance was recorded in this period.');
    }
    return out;
  }

  private async members(scope: ReportScope, range: ReportRange) {
    const out = this.shell('members');
    const base = this.base(scope);

    const [total, joined, byStatus] = await Promise.all([
      this.memberModel.countDocuments({
        ...base,
        createdAt: { $lte: range.end },
      }),
      this.memberModel
        .find({ ...base, createdAt: { $gte: range.start, $lte: range.end } })
        .select('createdAt membershipStatus')
        .maxTimeMS(20_000)
        .lean(),
      this.memberModel.aggregate([
        { $match: { ...base, createdAt: { $lte: range.end } } },
        { $group: { _id: '$membershipStatus', n: { $sum: 1 } } },
      ]),
    ]);

    const visitors = joined.filter((m: any) => {
      return m.membershipStatus === 'VISITOR';
    }).length;
    const byDay = new Map<string, number>();
    for (const m of joined as any[]) {
      const day = toDateStr(m.createdAt);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }

    out.metrics.push(
      metric('members_total', 'Total members', total),
      metric('members_new', 'New members', joined.length),
      metric('members_visitors', 'New first-time visitors', visitors),
    );
    out.series.push(
      seriesFromMap('members_new_by_day', 'New members', range, byDay),
    );
    out.breakdowns.push(
      breakdown(
        'members_by_status',
        'Members by status',
        new Map(
          byStatus.map((r: any) => {
            return [r._id || 'Unspecified', r.n];
          }),
        ),
      ),
    );
    return out;
  }

  private async attention(scope: ReportScope, range: ReportRange) {
    const out = this.shell('attention');

    const pipeline: any[] = [
      { $match: { churchId: scope.churchId, createdAt: { $lte: range.end } } },
    ];
    if (scope.branchIds) {
      pipeline.push(
        {
          $lookup: {
            from: 'members',
            localField: 'memberId',
            foreignField: '_id',
            as: 'member',
          },
        },
        { $unwind: '$member' },
        { $match: { 'member.branchId': { $in: scope.branchIds } } },
      );
    }
    pipeline.push({
      $project: {
        severity: 1,
        category: 1,
        resolved: 1,
        resolvedAt: 1,
        createdAt: 1,
      },
    });

    const alerts: any[] = await this.alertModel.aggregate(pipeline);
    const inRange = (d?: Date | null) => {
      return !!d && d >= range.start && d <= range.end;
    };

    const raised = alerts.filter((a) => {
      return inRange(a.createdAt);
    });
    const resolvedNow = alerts.filter((a) => {
      return inRange(a.resolvedAt);
    });
    const open = alerts.filter((a) => {
      return !a.resolved || (a.resolvedAt && a.resolvedAt > range.end);
    });
    const urgentOpen = open.filter((a) => {
      return a.severity === 'urgent' || a.severity === 'high';
    });

    const raisedByDay = new Map<string, number>();
    for (const a of raised) {
      const day = toDateStr(a.createdAt);
      raisedByDay.set(day, (raisedByDay.get(day) ?? 0) + 1);
    }
    const tally = (list: any[], field: string) => {
      const m = new Map<string, number>();
      for (const a of list) {
        m.set(a[field], (m.get(a[field]) ?? 0) + 1);
      }
      return m;
    };

    out.metrics.push(
      metric('attention_raised', 'New alerts', raised.length),
      metric(
        'attention_resolved',
        'Followed up and resolved',
        resolvedNow.length,
      ),
      metric('attention_open', 'Still open', open.length),
      metric(
        'attention_urgent',
        'Urgent or high priority open',
        urgentOpen.length,
      ),
    );
    out.series.push(
      seriesFromMap(
        'attention_raised_by_day',
        'New alerts',
        range,
        raisedByDay,
      ),
    );
    out.breakdowns.push(
      breakdown(
        'attention_by_category',
        'New alerts by type',
        tally(raised, 'category'),
      ),
      breakdown(
        'attention_open_by_severity',
        'Open alerts by priority',
        tally(open, 'severity'),
      ),
    );
    return out;
  }

  private async teams(scope: ReportScope, range: ReportRange) {
    const out = this.shell('teams');
    const base = this.base(scope);

    const [teams, created] = await Promise.all([
      this.smallTeamModel
        .find({
          ...base,
          status: SmallTeamStatus.ACTIVE,
          createdAt: { $lte: range.end },
        })
        .select('name memberIds')
        .lean(),
      this.smallTeamModel.countDocuments({
        ...base,
        createdAt: { $gte: range.start, $lte: range.end },
      }),
    ]);

    const sizes = new Map<string, number>(
      (teams as any[]).map((t) => {
        return [t.name, t.memberIds?.length ?? 0];
      }),
    );
    const totalMembers = [...sizes.values()].reduce((a, b) => {
      return a + b;
    }, 0);

    out.metrics.push(
      metric('teams_active', 'Active teams', teams.length),
      metric('teams_new', 'New teams', created),
      metric('teams_members', 'People in teams', totalMembers),
      metric(
        'teams_average',
        'Average team size',
        teams.length ? totalMembers / teams.length : 0,
      ),
    );
    out.breakdowns.push(breakdown('teams_by_size', 'Largest teams', sizes));
    return out;
  }

  // ------------------------------------------------------------------
  // Finance
  // ------------------------------------------------------------------

  private async giving(scope: ReportScope, range: ReportRange) {
    const out = this.shell('giving');

    const batches: any[] = await this.batchModel
      .find({
        ...this.base(scope),
        isVoided: false,
        date: { $gte: range.startStr, $lte: range.endStr },
      })
      .select('_id date')
      .lean();

    out.metrics.push(
      metric('giving_batches', 'Giving records', batches.length),
    );
    if (!batches.length) {
      out.notes.push('No giving was recorded in this period.');
      return out;
    }

    const dateByBatch = new Map(
      batches.map((b) => {
        return [String(b._id), b.date];
      }),
    );
    const rows: any[] = await this.entryModel.aggregate([
      {
        $match: {
          batchId: {
            $in: batches.map((b) => {
              return b._id;
            }),
          },
        },
      },
      {
        $group: {
          _id: {
            batch: '$batchId',
            cur: '$currencyCode',
            type: '$offeringTypeId',
            method: '$paymentMethod',
          },
          total: { $sum: '$amount' },
        },
      },
    ]);

    const totalByCur = new Map<string, number>();
    for (const r of rows) {
      const cur = r._id.cur || 'N/A';
      totalByCur.set(cur, (totalByCur.get(cur) ?? 0) + r.total);
    }
    const currencies = topEntries(
      totalByCur,
      (v) => {
        return v;
      },
      TOP_CURRENCIES,
    );

    const typeIds = [
      ...new Set(
        rows.map((r) => {
          return String(r._id.type);
        }),
      ),
    ];
    const types: any[] = await this.offeringTypeModel
      .find({ _id: { $in: typeIds } })
      .select('name')
      .lean();
    const typeName = new Map(
      types.map((t) => {
        return [String(t._id), t.name];
      }),
    );

    for (const [cur, total] of currencies) {
      out.metrics.push(
        metric(
          `giving_total_${cur}`,
          `Total given (${cur})`,
          total,
          'currency',
          cur,
        ),
      );
    }

    currencies.forEach(([cur], index) => {
      const byDate = new Map<string, number>();
      for (const r of rows) {
        if ((r._id.cur || 'N/A') !== cur) {
          continue;
        }
        const day = dateByBatch.get(String(r._id.batch));
        if (day) {
          byDate.set(day, (byDate.get(day) ?? 0) + r.total);
        }
      }
      out.series.push(
        seriesFromMap(
          `giving_by_day_${cur}`,
          `Giving by day (${cur})`,
          range,
          byDate,
          cur,
        ),
      );

      if (index === 0) {
        const byType = new Map<string, number>();
        const byMethod = new Map<string, number>();
        for (const r of rows) {
          if ((r._id.cur || 'N/A') !== cur) {
            continue;
          }
          const name = typeName.get(String(r._id.type)) ?? 'Other';
          byType.set(name, (byType.get(name) ?? 0) + r.total);
          byMethod.set(
            r._id.method,
            (byMethod.get(r._id.method) ?? 0) + r.total,
          );
        }
        out.breakdowns.push(
          breakdown(
            `giving_by_type_${cur}`,
            `By offering type (${cur})`,
            byType,
            'currency',
            cur,
          ),
          breakdown(
            `giving_by_method_${cur}`,
            `By payment method (${cur})`,
            byMethod,
            'currency',
            cur,
          ),
        );
      }
    });

    if (totalByCur.size > TOP_CURRENCIES) {
      out.notes.push(`Showing the ${TOP_CURRENCIES} largest currencies.`);
    }
    if (totalByCur.size > 1) {
      out.notes.push(
        'Amounts in different currencies are never added together.',
      );
    }
    return out;
  }

  private async expenses(scope: ReportScope, range: ReportRange) {
    const out = this.shell('expenses');

    const rows: any[] = await this.expenseModel.aggregate([
      {
        $match: {
          ...this.base(scope),
          date: { $gte: range.start, $lte: range.end },
        },
      },
      {
        $group: {
          _id: {
            cur: '$currency',
            cat: '$category',
            day: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          },
          total: { $sum: '$amount' },
          n: { $sum: 1 },
        },
      },
    ]);

    const count = rows.reduce((sum, r) => {
      return sum + r.n;
    }, 0);
    out.metrics.push(metric('expenses_count', 'Expenses recorded', count));
    if (!rows.length) {
      out.notes.push('No expenses were recorded in this period.');
      return out;
    }

    const totalByCur = new Map<string, number>();
    for (const r of rows) {
      const cur = r._id.cur || 'N/A';
      totalByCur.set(cur, (totalByCur.get(cur) ?? 0) + r.total);
    }
    const currencies = topEntries(
      totalByCur,
      (v) => {
        return v;
      },
      TOP_CURRENCIES,
    );

    for (const [cur, total] of currencies) {
      out.metrics.push(
        metric(
          `expenses_total_${cur}`,
          `Total spent (${cur})`,
          total,
          'currency',
          cur,
        ),
      );
    }

    currencies.forEach(([cur], index) => {
      const byDate = new Map<string, number>();
      const byCat = new Map<string, number>();
      for (const r of rows) {
        if ((r._id.cur || 'N/A') !== cur) {
          continue;
        }
        byDate.set(r._id.day, (byDate.get(r._id.day) ?? 0) + r.total);
        const cat = r._id.cat || 'Uncategorised';
        byCat.set(cat, (byCat.get(cat) ?? 0) + r.total);
      }
      out.series.push(
        seriesFromMap(
          `expenses_by_day_${cur}`,
          `Spending by day (${cur})`,
          range,
          byDate,
          cur,
        ),
      );
      if (index === 0) {
        out.breakdowns.push(
          breakdown(
            `expenses_by_category_${cur}`,
            `By category (${cur})`,
            byCat,
            'currency',
            cur,
          ),
        );
      }
    });

    if (totalByCur.size > 1) {
      out.notes.push(
        'Amounts in different currencies are never added together.',
      );
    }
    return out;
  }

  // ------------------------------------------------------------------
  // Operations
  // ------------------------------------------------------------------

  private async requests(scope: ReportScope, range: ReportRange) {
    const out = this.shell('requests');
    const base = this.base(scope);

    const [submitted, reviewed, pendingNow] = await Promise.all([
      this.requisitionModel
        .find({ ...base, createdAt: { $gte: range.start, $lte: range.end } })
        .select('status createdAt')
        .lean(),
      this.requisitionModel
        .find({
          ...base,
          status: {
            $in: [RequisitionStatus.APPROVED, RequisitionStatus.REJECTED],
          },
          reviewedAt: { $gte: range.start, $lte: range.end },
        })
        .select('status amount currency')
        .lean(),
      this.requisitionModel.countDocuments({
        ...base,
        status: RequisitionStatus.PENDING,
        createdAt: { $lte: range.end },
      }),
    ]);

    const approved = (reviewed as any[]).filter((r) => {
      return r.status === RequisitionStatus.APPROVED;
    });
    const rejected = (reviewed as any[]).length - approved.length;
    const approvedByCur = new Map<string, number>();
    for (const r of approved) {
      const cur = r.currency || 'N/A';
      approvedByCur.set(cur, (approvedByCur.get(cur) ?? 0) + (r.amount || 0));
    }

    const byDay = new Map<string, number>();
    for (const r of submitted as any[]) {
      const day = toDateStr(r.createdAt);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }

    out.metrics.push(
      metric('requests_submitted', 'Requests submitted', submitted.length),
      metric('requests_approved', 'Approved', approved.length),
      metric('requests_rejected', 'Declined', rejected),
      metric('requests_pending', 'Waiting for review', pendingNow),
    );
    for (const [cur, total] of topEntries(
      approvedByCur,
      (v) => {
        return v;
      },
      TOP_CURRENCIES,
    )) {
      out.metrics.push(
        metric(
          `requests_approved_total_${cur}`,
          `Approved value (${cur})`,
          total,
          'currency',
          cur,
        ),
      );
    }
    out.series.push(
      seriesFromMap('requests_by_day', 'Requests submitted', range, byDay),
    );
    return out;
  }

  private async events(scope: ReportScope, range: ReportRange) {
    const out = this.shell('events');

    const instances: any[] = await this.serviceInstanceModel
      .find({
        ...this.base(scope),
        date: { $gte: range.start, $lte: range.end },
      })
      .select('date type reminderEnabled')
      .lean();

    const byDay = new Map<string, number>();
    const byType = new Map<string, number>();
    for (const i of instances) {
      const day = toDateStr(i.date);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
      const type = i.type || 'Service';
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }

    out.metrics.push(
      metric('events_total', 'Services and events', instances.length),
      metric(
        'events_reminders',
        'With reminders on',
        instances.filter((i) => {
          return i.reminderEnabled;
        }).length,
      ),
    );
    out.series.push(
      seriesFromMap('events_by_day', 'Services and events', range, byDay),
    );
    out.breakdowns.push(breakdown('events_by_type', 'By type', byType));
    return out;
  }

  private async departments(scope: ReportScope, range: ReportRange) {
    const out = this.shell('departments');
    const base = this.base(scope);

    const [departments, created] = await Promise.all([
      this.departmentModel
        .find({
          ...base,
          status: DepartmentStatus.ACTIVE,
          createdAt: { $lte: range.end },
        })
        .select('name members')
        .lean(),
      this.departmentModel.countDocuments({
        ...base,
        createdAt: { $gte: range.start, $lte: range.end },
      }),
    ]);

    const sizes = new Map<string, number>(
      (departments as any[]).map((d) => {
        return [d.name, d.members?.length ?? 0];
      }),
    );
    const total = [...sizes.values()].reduce((a, b) => {
      return a + b;
    }, 0);

    out.metrics.push(
      metric('departments_active', 'Active departments', departments.length),
      metric('departments_new', 'New departments', created),
      metric('departments_members', 'People serving in departments', total),
    );
    out.breakdowns.push(
      breakdown('departments_by_size', 'Largest departments', sizes),
    );
    return out;
  }

  private async assets(scope: ReportScope, range: ReportRange) {
    const out = this.shell('assets');
    const base = this.base(scope);

    const [active, added, overdue, byCondition, services] = await Promise.all([
      this.assetModel.countDocuments({
        ...base,
        status: AssetStatus.ACTIVE,
        createdAt: { $lte: range.end },
      }),
      this.assetModel.countDocuments({
        ...base,
        createdAt: { $gte: range.start, $lte: range.end },
      }),
      this.assetModel.countDocuments({
        ...base,
        status: AssetStatus.ACTIVE,
        'schedule.nextDue': { $lt: range.end },
      }),
      this.assetModel.aggregate([
        { $match: { ...base, status: AssetStatus.ACTIVE } },
        { $group: { _id: '$condition', n: { $sum: 1 } } },
      ]),
      this.assetModel.aggregate([
        {
          $match: {
            ...base,
            'services.date': { $gte: range.start, $lte: range.end },
          },
        },
        { $unwind: '$services' },
        { $match: { 'services.date': { $gte: range.start, $lte: range.end } } },
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$services.date' },
            },
            n: { $sum: 1 },
          },
        },
      ]),
    ]);

    const byDay = new Map<string, number>(
      (services as any[]).map((s) => {
        return [s._id, s.n];
      }),
    );
    const logged = [...byDay.values()].reduce((a, b) => {
      return a + b;
    }, 0);

    out.metrics.push(
      metric('assets_active', 'Active assets', active),
      metric('assets_added', 'Assets added', added),
      metric('assets_serviced', 'Services logged', logged),
      metric('assets_overdue', 'Overdue for service', overdue),
    );
    out.series.push(
      seriesFromMap('assets_services_by_day', 'Services logged', range, byDay),
    );
    out.breakdowns.push(
      breakdown(
        'assets_by_condition',
        'Condition of active assets',
        new Map(
          (byCondition as any[]).map((c) => {
            return [c._id || 'Unspecified', c.n];
          }),
        ),
      ),
    );
    return out;
  }
}
