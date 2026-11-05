import { Types } from 'mongoose';

import { GuestLifecycleService } from './guest-lifecycle.service';

const churchId = new Types.ObjectId();
const now = new Date('2026-11-05T01:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000);
const dayKey = (n: number) => daysAgo(n).toISOString().slice(0, 10);

const lean = (value: any) => ({
  select: () => ({ lean: async () => value }),
  lean: async () => value,
});

function build(opts: {
  guests?: { _id: Types.ObjectId; createdAt: Date }[];
  lastPresent?: Map<string, string>;
  archiveAfterDays?: number;
  findResults?: any[];
}) {
  const findQueue = [...(opts.findResults ?? [])];
  const memberModel: any = {
    find: jest.fn(() => lean(findQueue.length ? findQueue.shift() : opts.guests ?? [])),
    updateMany: jest.fn(async (filter: any) => ({
      modifiedCount: filter._id?.$in?.length ?? 0,
    })),
    deleteMany: jest.fn(async (filter: any) => ({
      deletedCount: filter._id?.$in?.length ?? 0,
    })),
  };
  const settingsModel: any = {
    findOne: () => lean({ archiveAfterDays: opts.archiveAfterDays ?? 90 }),
  };
  const attendanceModel: any = { deleteMany: jest.fn(async () => ({})) };
  const departmentModel: any = { updateMany: jest.fn(async () => ({})) };
  const smallTeamModel: any = { updateMany: jest.fn(async () => ({})) };
  const adminModel: any = { find: () => lean([{ email: 'a@x.org', firstName: 'A' }]) };
  const guestRules: any = {
    lastPresentDays: jest.fn(async () => opts.lastPresent ?? new Map()),
    getFrequentGuestIds: jest.fn(async () => []),
  };
  const notifications: any = { createNotification: jest.fn(async () => ({})) };
  const email: any = { sendEmail: jest.fn(async () => ({})) };

  const service = new GuestLifecycleService(
    memberModel,
    attendanceModel,
    settingsModel,
    departmentModel,
    smallTeamModel,
    adminModel,
    guestRules,
    notifications,
    email,
  );
  return { service, memberModel, attendanceModel, notifications, email, departmentModel };
}

describe('GuestLifecycleService', () => {
  it('archives guests whose last attendance is older than the church period', async () => {
    const stale = new Types.ObjectId();
    const recent = new Types.ObjectId();
    const neverOld = new Types.ObjectId();
    const neverNew = new Types.ObjectId();
    const { service, memberModel } = build({
      archiveAfterDays: 90,
      guests: [
        { _id: stale, createdAt: daysAgo(400) },
        { _id: recent, createdAt: daysAgo(400) },
        { _id: neverOld, createdAt: daysAgo(91) },
        { _id: neverNew, createdAt: daysAgo(10) },
      ],
      lastPresent: new Map([
        [String(stale), dayKey(91)],
        [String(recent), dayKey(89)],
      ]),
    });

    const archived = await service.archiveInactiveGuests(churchId, now);

    expect(archived).toBe(2);
    const [filter, update] = memberModel.updateMany.mock.calls[0];
    expect(filter._id.$in.map(String).sort()).toEqual([String(stale), String(neverOld)].sort());
    expect(filter.archivedAt).toBeNull();
    expect(update.$set.archivedAt).toEqual(now);
  });

  it('clamps the archive period to 30-180 days', async () => {
    const g = new Types.ObjectId();
    const { service } = build({
      archiveAfterDays: 5,
      guests: [{ _id: g, createdAt: daysAgo(20) }],
    });
    // 20 days inactive is under the 30-day minimum, so nothing is archived.
    expect(await service.archiveInactiveGuests(churchId, now)).toBe(0);
  });

  it('warns 30 days before deletion, in-app and by email', async () => {
    const id = new Types.ObjectId();
    const { service, notifications, email, memberModel } = build({
      findResults: [[{ _id: id, archivedAt: daysAgo(336) }]],
    });

    expect(await service.warnBeforeDeletion(churchId, now)).toBe(1);
    expect(notifications.createNotification).toHaveBeenCalled();
    expect(email.sendEmail).toHaveBeenCalledWith('a@x.org', expect.any(String), expect.any(String));
    // Only guests archived at least 335 days ago are due for a warning.
    const filter = memberModel.find.mock.calls[0][0];
    expect(filter.archivedAt.$lte).toEqual(daysAgo(335));
    expect(filter.archiveDeletionWarnedAt).toBeNull();
  });

  it('deletes only guests archived 12+ months ago and warned 30+ days ago', async () => {
    const id = new Types.ObjectId();
    const { service, memberModel, attendanceModel, departmentModel } = build({
      findResults: [[{ _id: id }]],
    });

    expect(await service.deleteExpiredArchives(churchId, now)).toBe(1);
    const filter = memberModel.find.mock.calls[0][0];
    expect(filter.archivedAt.$lte).toEqual(daysAgo(365));
    expect(filter.archiveDeletionWarnedAt.$lte).toEqual(daysAgo(30));
    expect(attendanceModel.deleteMany).toHaveBeenCalledWith({ memberId: { $in: [id] } });
    expect(departmentModel.updateMany).toHaveBeenCalled();
  });
});
