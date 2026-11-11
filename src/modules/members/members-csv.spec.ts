import { Types } from 'mongoose';

import { AdminAccessScope } from '../../common/utils/enums.utils';
import { MembersService } from './members.service';

const tenant = {
  churchId: new Types.ObjectId(),
  branchId: new Types.ObjectId(),
  accessScope: AdminAccessScope.BRANCH,
  accessibleBranchIds: [],
} as any;

const HEADER =
  'fullName,gender,phoneNumber,email,membershipStatus,cellGroupName';

function build(room: { members: number | null; guests: number | null }) {
  const memberModel: any = {
    find: () => {
      return {
        setOptions: () => {
          return {
            select: () => {
              return {
                lean: async () => {
                  return [];
                },
              };
            },
          };
        },
      };
    },
    insertMany: jest.fn(async (docs: any[]) => {
      return docs;
    }),
  };
  const guestRules: any = {
    getLimitSnapshot: jest.fn(async () => {
      return {
        room,
        memberLimit: 100,
        guestLimit: 200,
      };
    }),
  };
  const service = new MembersService(
    memberModel,
    {} as any,
    {} as any,
    { create: jest.fn() } as any,
    { createNotification: jest.fn() } as any,
    {} as any,
    guestRules,
    {} as any,
    {} as any,
  );
  return { service, memberModel };
}

const csv = (...rows: string[]) => {
  return Buffer.from([HEADER, ...rows].join('\n'));
};

describe('Member CSV import', () => {
  it('rejects blank and unknown statuses instead of guessing', async () => {
    const { service } = build({ members: 10, guests: 10 });
    const res = await service.parseAndValidateCsv(
      tenant,
      csv(
        'Ada Obi,FEMALE,0801,ada@x.org,,',
        'Ben Eze,MALE,0802,ben@x.org,Inactive,',
        'Chi Ude,MALE,0803,chi@x.org,New convert,',
      ),
    );
    expect(
      res.errors.map((e) => {
        return [e.row, e.column];
      }),
    ).toEqual([
      [2, 'status'],
      [3, 'status'],
    ]);
    expect(res.members).toHaveLength(1);
    expect(res.members[0].membershipStatus).toBe('NEW CONVERT');
  });

  it('rejects a guest with a cell group', async () => {
    const { service } = build({ members: 10, guests: 10 });
    const res = await service.parseAndValidateCsv(
      tenant,
      csv('Ada Obi,FEMALE,0801,ada@x.org,Visitor,Iota Group'),
    );
    expect(res.errors[0]).toMatchObject({ row: 2, column: 'cellGroupName' });
  });

  it('summarises members vs guests and blocks a file over a limit', async () => {
    const { service, memberModel } = build({ members: 1, guests: 5 });
    const file = csv(
      'Ada Obi,FEMALE,0801,ada@x.org,Visitor,',
      'Ben Eze,MALE,0802,ben@x.org,Member,',
      'Chi Ude,MALE,0803,chi@x.org,Worker,',
    );
    const report = await service.previewMembersCsv(
      { churchId: tenant.churchId } as any,
      tenant,
      file,
    );
    expect(report).toMatchObject({
      addMembers: 2,
      addGuests: 1,
      overBy: { members: 1, guests: 0 },
      canImport: false,
    });

    await expect(
      service.createMembersByCsv(
        { churchId: tenant.churchId } as any,
        tenant,
        file,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MEMBER_LIMIT' }),
    });
    expect(memberModel.insertMany).not.toHaveBeenCalled();
  });
});
