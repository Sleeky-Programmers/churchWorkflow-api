import { ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

import { AdminAccessScope } from '../../../common/utils/enums.utils';
import { BranchService } from '../../branch/branch.service';
import { TimerBranchesController } from './timer-branches.controller';

const churchId = new Types.ObjectId();
const admin = {
  _id: new Types.ObjectId(),
  churchId,
  accessScope: AdminAccessScope.ORG_WIDE,
} as any;

function setup(opts: { plan: any; active: number }) {
  const created: any[] = [];
  const branchModel = {
    findOne: async () => {
      return null;
    },
    countDocuments: async () => {
      return opts.active;
    },
    create: async (doc: any) => {
      created.push(doc);
      return { _id: new Types.ObjectId(), ...doc };
    },
  };
  const cwSubscriptions = {
    checkBranchLimit: jest.fn().mockResolvedValue({ allowed: true }),
  };
  const branches = new BranchService(
    branchModel as any,
    {} as any,
    {} as any,
    cwSubscriptions as any,
  );
  const plans = {
    planFor: async () => {
      return opts.plan;
    },
  };
  const controller = new TimerBranchesController(branches, plans as any);
  return { controller, created, cwSubscriptions };
}

describe('TimerBranchesController', () => {
  it('keeps a Free church to one branch', async () => {
    const { controller, created } = setup({
      plan: { key: 'FREE', branchLimit: 1 },
      active: 1,
    });
    await expect(
      controller.create(admin, { name: 'Lekki' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(created).toHaveLength(0);
  });

  it('lets a Church plan add branches up to its limit', async () => {
    const { controller, created, cwSubscriptions } = setup({
      plan: { key: 'CHURCH', branchLimit: 5 },
      active: 4,
    });
    const res = await controller.create(admin, { name: ' Lekki ' });
    expect(res.name).toBe('Lekki');
    expect(created).toHaveLength(1);
    // The timer's limit replaces Church Workflow's check.
    expect(cwSubscriptions.checkBranchLimit).not.toHaveBeenCalled();

    const full = setup({ plan: { key: 'CHURCH', branchLimit: 5 }, active: 5 });
    await expect(
      full.controller.create(admin, { name: 'Ikeja' }),
    ).rejects.toThrow('5 branches');
  });

  it("leaves Church Workflow churches on Church Workflow's limits", async () => {
    const { controller, cwSubscriptions } = setup({
      plan: { key: 'CHURCH_WORKFLOW', branchLimit: null },
      active: 9,
    });
    await controller.create(admin, { name: 'Abuja' });
    expect(cwSubscriptions.checkBranchLimit).toHaveBeenCalledWith(churchId, 9);
  });

  it('treats a limit of 0 as unlimited', async () => {
    const { controller, created } = setup({
      plan: { key: 'CHURCH', branchLimit: 0 },
      active: 40,
    });
    await controller.create(admin, { name: 'Ibadan' });
    expect(created).toHaveLength(1);
  });
});
