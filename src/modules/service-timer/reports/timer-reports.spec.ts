import { Types } from 'mongoose';

import { HttpException } from '@nestjs/common';

import { serviceDateOf, TimerReportsService } from './timer-reports.service';

const scope = {
  churchId: new Types.ObjectId(),
  branchId: new Types.ObjectId(),
};

function build(planKey = 'CHURCH', runs: any[] = []) {
  const writes: any[] = [];
  const runModel = {
    bulkWrite: jest.fn(async (ops) => {
      return writes.push(...ops);
    }),
    aggregate: jest.fn(async () => {
      return [];
    }),
    find: () => {
      return {
        sort: () => {
          return {
            lean: async () => {
              return runs;
            },
          };
        },
      };
    },
  };
  const lean = (v: any) => {
    return {
      select: () => {
        return {
          lean: async () => {
            return v;
          },
        };
      },
    };
  };
  const service = new TimerReportsService(
    runModel as any,
    {
      findById: () => {
        return lean({ timeZone: 'Africa/Lagos' });
      },
    } as any,
    {
      findById: () => {
        return lean({ timeZone: null });
      },
    } as any,
    {
      planFor: async () => {
        return { key: planKey };
      },
    } as any,
  );
  return { service, writes };
}

describe('service reports', () => {
  it('dates a service in the church time zone', () => {
    // 23:30 UTC on Saturday is already Sunday in Lagos (UTC+1).
    const ms = Date.UTC(2026, 10, 7, 23, 30);
    expect(serviceDateOf(ms, 'Africa/Lagos')).toBe('2026-11-08');
    expect(serviceDateOf(ms, 'UTC')).toBe('2026-11-07');
    expect(serviceDateOf(ms, 'Not/AZone')).toBe('2026-11-08');
  });

  it('keeps one record per run, taking the longest snapshot', async () => {
    const { service, writes } = build();
    const now = Date.now();
    await service.recordRuns(scope, [
      {
        id: 'a:1',
        name: 'Prayer',
        plannedMinutes: 8,
        extraMs: 0,
        actualMs: 300_000,
        startedAt: now - 300_000,
        endedAt: now,
      },
    ]);
    const op = writes[0].updateOne;
    expect(op.filter).toEqual({ churchId: scope.churchId, runId: 'a:1' });
    expect(op.upsert).toBe(true);
    expect(op.update.$max).toEqual({
      actualMs: 300_000,
      endedAt: new Date(now),
    });
    expect(op.update.$setOnInsert.serviceDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('ignores runs from a device with a wildly wrong clock', async () => {
    const { service, writes } = build();
    const old = Date.now() - 30 * 86_400_000;
    await service.recordRuns(scope, [
      {
        id: 'x',
        name: 'Old',
        plannedMinutes: 5,
        extraMs: 0,
        actualMs: 1,
        startedAt: old,
        endedAt: old,
      },
    ]);
    expect(writes).toHaveLength(0);
  });

  it('records on Free but only shows reports on the Church plan', async () => {
    const free = build('FREE');
    const err = await free.service.listServices(scope).catch((e) => {
      return e;
    });
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getResponse()).toMatchObject({ code: 'PLAN_REQUIRED' });
    await expect(
      build('CHURCH_WORKFLOW').service.listServices(scope),
    ).resolves.toEqual([]);
  });

  it('summarises a service against its program', async () => {
    const t = new Date('2026-11-08T08:00:00Z');
    const at = (min: number) => {
      return new Date(+t + min * 60000);
    };
    const { service } = build('CHURCH', [
      {
        itemName: 'Prayer',
        person: '',
        plannedMinutes: 10,
        extraMs: 0,
        actualMs: 12 * 60000,
        startedAt: at(0),
        endedAt: at(12),
      },
      {
        itemName: 'The Word',
        person: 'Pst. O',
        plannedMinutes: 40,
        extraMs: 300000,
        actualMs: 46 * 60000,
        startedAt: at(12),
        endedAt: at(58),
      },
    ]);
    const s = await service.service(scope, '2026-11-08');
    expect(s.plannedMs).toBe(50 * 60000);
    expect(s.actualMs).toBe(58 * 60000);
    expect(s.overMs).toBe(8 * 60000);
    expect(
      s.items.map((i) => {
        return i.overMs;
      }),
    ).toEqual([2 * 60000, 6 * 60000]);
    expect(s.endedAt).toEqual(at(58));
  });
});
