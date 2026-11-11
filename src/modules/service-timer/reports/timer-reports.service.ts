import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Model, Types } from 'mongoose';

import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Branch } from '../../../schemas/branch.schema';
import { Church } from '../../../schemas/church.schema';
import { TimerItemRun } from '../../../schemas/timer-item-run.schema';
import { TimerPlanService } from '../billing/timer-plan.service';
import type { TimerScope } from '../service-timer.service';

export class ItemRunDto {
  @IsString() @MaxLength(80) id: string;
  @IsString() @MaxLength(120) name: string;
  @IsOptional() @IsString() @MaxLength(80) person?: string;
  @IsNumber() @Min(0) @Max(600) plannedMinutes: number;
  @IsNumber() extraMs: number;
  // Up to 12 hours.
  @IsNumber() @Min(0) @Max(43_200_000) actualMs: number;
  @IsNumber() startedAt: number;
  @IsNumber() endedAt: number;
}

export class ItemRunsDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => {
    return ItemRunDto;
  })
  runs: ItemRunDto[];
}

/** "YYYY-MM-DD" for a moment in a time zone (falls back to Lagos). */
export function serviceDateOf(ms: number, timeZone?: string | null) {
  const fmt = (tz: string) => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms));
  };
  try {
    return fmt(timeZone || 'Africa/Lagos');
  } catch {
    return fmt('Africa/Lagos');
  }
}

/**
 * Service reports (Product Plan, section 7, Church plan): how each service
 * ran against its program. Runs are recorded on every plan so upgrading
 * shows past services too; reading reports needs the Church plan (or
 * Church Workflow).
 */
@Injectable()
export class TimerReportsService {
  constructor(
    @InjectModel(TimerItemRun.name) private runModel: Model<TimerItemRun>,
    @InjectModel(Church.name) private churchModel: Model<Church>,
    @InjectModel(Branch.name) private branchModel: Model<Branch>,
    private plans: TimerPlanService,
  ) {}

  private async timeZoneFor(scope: TimerScope) {
    const [branch, church] = await Promise.all([
      this.branchModel.findById(scope.branchId).select('timeZone').lean(),
      this.churchModel.findById(scope.churchId).select('timeZone').lean(),
    ]);
    return branch?.timeZone || church?.timeZone || null;
  }

  /** Saves runs from a device; repeated snapshots of one run update it. */
  async recordRuns(scope: TimerScope, runs: ItemRunDto[]) {
    if (!runs.length) {
      return { saved: 0 };
    }
    const tz = await this.timeZoneFor(scope);
    const now = Date.now();
    await this.runModel.bulkWrite(
      runs
        // Ignore runs from a device with a badly wrong clock.
        .filter((r) => {
          return (
            r.startedAt > now - 7 * 86_400_000 && r.startedAt < now + 86_400_000
          );
        })
        .map((r) => {
          return {
            updateOne: {
              filter: { churchId: scope.churchId, runId: r.id },
              update: {
                $setOnInsert: {
                  churchId: scope.churchId,
                  branchId: scope.branchId,
                  runId: r.id,
                  startedAt: new Date(r.startedAt),
                  serviceDate: serviceDateOf(r.startedAt, tz),
                },
                $set: {
                  itemName: r.name,
                  person: r.person ?? '',
                  plannedMinutes: r.plannedMinutes,
                  extraMs: r.extraMs,
                },
                // Snapshots can arrive out of order: keep the longest.
                $max: { actualMs: r.actualMs, endedAt: new Date(r.endedAt) },
              },
              upsert: true,
            },
          };
        }),
      { ordered: false },
    );
    return { saved: runs.length };
  }

  private async assertReportsIncluded(churchId: Types.ObjectId) {
    const plan = await this.plans.planFor(churchId);
    if (plan.key === 'FREE') {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          code: 'PLAN_REQUIRED',
          message:
            "Service reports are part of the Church plan. Your services are already being recorded, so they'll all be here when you upgrade.",
        },
        HttpStatus.FORBIDDEN,
      );
    }
  }

  /** Services in the last `days` days, newest first. */
  async listServices(scope: TimerScope, days = 90) {
    await this.assertReportsIncluded(scope.churchId);
    const since = serviceDateOf(
      Date.now() - days * 86_400_000,
      await this.timeZoneFor(scope),
    );
    const rows = await this.runModel.aggregate([
      {
        $match: {
          churchId: scope.churchId,
          branchId: scope.branchId,
          serviceDate: { $gte: since },
        },
      },
      {
        $group: {
          _id: '$serviceDate',
          startedAt: { $min: '$startedAt' },
          endedAt: { $max: '$endedAt' },
          items: { $sum: 1 },
          plannedMs: { $sum: { $multiply: ['$plannedMinutes', 60000] } },
          actualMs: { $sum: '$actualMs' },
        },
      },
      { $sort: { _id: -1 } },
    ]);
    return rows.map((r) => {
      return {
        date: r._id as string,
        startedAt: r.startedAt,
        endedAt: r.endedAt,
        items: r.items,
        plannedMs: r.plannedMs,
        actualMs: r.actualMs,
        overMs: r.actualMs - r.plannedMs,
      };
    });
  }

  /** One service, item by item against the program. */
  async service(scope: TimerScope, date: string) {
    await this.assertReportsIncluded(scope.churchId);
    const runs = await this.runModel
      .find({
        churchId: scope.churchId,
        branchId: scope.branchId,
        serviceDate: date,
      })
      .sort({ startedAt: 1 })
      .lean();
    const items = runs.map((r) => {
      const plannedMs = r.plannedMinutes * 60000;
      return {
        name: r.itemName,
        person: r.person,
        startedAt: r.startedAt,
        plannedMs,
        actualMs: r.actualMs,
        extraMs: r.extraMs,
        overMs: r.actualMs - plannedMs,
      };
    });
    const plannedMs = items.reduce((a, i) => {
      return a + i.plannedMs;
    }, 0);
    const actualMs = items.reduce((a, i) => {
      return a + i.actualMs;
    }, 0);
    return {
      date,
      startedAt: runs[0]?.startedAt ?? null,
      endedAt: runs.length
        ? runs.reduce((a, r) => {
            return r.endedAt > a ? r.endedAt : a;
          }, runs[0].endedAt)
        : null,
      plannedMs,
      actualMs,
      overMs: actualMs - plannedMs,
      items,
    };
  }
}
