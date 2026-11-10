import { Types } from 'mongoose';

import {
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';

import { decryptInvite } from '../../../common/helpers/crypto.helper';
import {
  AdminInviteStatus,
  ChurchProduct,
  RoleType,
} from '../../../common/utils/enums.utils';
import { AdminInviteService } from '../../admin-invite/admin-invite.service';
import { TimerTeamService } from './timer-team.service';

const churchId = new Types.ObjectId();
const roles: Record<string, any> = {
  'Timer Admin': {
    _id: new Types.ObjectId(),
    roleName: 'Timer Admin',
    type: RoleType.SYSTEM,
  },
  'Timer Operator': {
    _id: new Types.ObjectId(),
    roleName: 'Timer Operator',
    type: RoleType.SYSTEM,
  },
  'Timer Viewer': {
    _id: new Types.ObjectId(),
    roleName: 'Timer Viewer',
    type: RoleType.SYSTEM,
  },
  'Super Admin': {
    _id: new Types.ObjectId(),
    roleName: 'Super Admin',
    type: RoleType.SYSTEM,
  },
  Ushers: {
    _id: new Types.ObjectId(),
    roleName: 'Ushers',
    type: RoleType.CUSTOM,
  },
};
const person = (
  first: string,
  role: string,
  email = `${first.toLowerCase()}@example.com`,
) => ({
  _id: new Types.ObjectId(),
  churchId,
  firstName: first,
  lastName: 'Obi',
  email,
  churchRole: roles[role],
});

const owner = person('Ada', 'Super Admin');
const operator = person('Ben', 'Timer Operator');
const usher = person('Cy', 'Ushers');
const me = person('Dee', 'Timer Admin');

function build(opts: { invites?: any[] } = {}) {
  const invites = opts.invites ?? [];
  const admins = [owner, operator, usher, me];
  const chain = (v: any) => ({
    populate: () => ({
      sort: () => ({ lean: async () => v }),
      lean: async () => v,
      then: (r: any) => r(v),
    }),
  });
  const adminModel = {
    find: () => chain(admins),
    findOne: (q: any) => ({
      populate: async () =>
        admins.find(
          (a) =>
            String(a._id) === String(q._id) &&
            String(a.churchId) === String(q.churchId),
        ) ?? null,
    }),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };
  const inviteModel = {
    find: () => chain(invites),
    findOne: jest.fn(
      async (q: any) =>
        invites.find(
          (i) =>
            (q._id ? String(i._id) === String(q._id) : true) &&
            (q.email ? i.email === q.email : true) &&
            String(i.churchId) === String(q.churchId),
        ) ?? null,
    ),
  };
  const adminInviteService = {
    getUserLimitStatus: jest
      .fn()
      .mockResolvedValue({ currentUsers: 4, limit: 5 }),
    sendInvitation: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
    resendInvitation: jest.fn(),
    deleteInvitation: jest.fn(),
    changeRole: jest.fn(),
    removeUser: jest.fn(),
  };
  const rolesService = { findOne: async (name: string) => roles[name] };
  const service = new TimerTeamService(
    adminModel as any,
    inviteModel as any,
    rolesService as any,
    adminInviteService as any,
  );
  return { service, adminModel, adminInviteService };
}

const authUser = me as any;

describe('TimerTeamService', () => {
  it('lists everyone, marking who the timer may change', async () => {
    const pendingInvite = {
      _id: new Types.ObjectId(),
      churchId,
      email: 'new@example.com',
      status: AdminInviteStatus.PENDING,
      churchRole: roles['Timer Viewer'],
    };
    const { service } = build({ invites: [pendingInvite] });
    const team = await service.list(authUser);
    const byName = Object.fromEntries(
      team.members.map((m) => [m.name.split(' ')[0], m]),
    );
    expect(byName.Ada).toMatchObject({
      roleName: 'Owner',
      isOwner: true,
      manageable: false,
    });
    expect(byName.Ben).toMatchObject({
      timerRole: 'operator',
      manageable: true,
    });
    expect(byName.Cy).toMatchObject({
      roleName: 'Ushers',
      timerRole: null,
      manageable: false,
    });
    expect(byName.Dee).toMatchObject({ isYou: true, manageable: false });
    expect(team.invites).toEqual([
      expect.objectContaining({
        email: 'new@example.com',
        timerRole: 'viewer',
      }),
    ]);
    expect(team.seats).toEqual({ used: 4, limit: 5 });
  });

  it('invites with a Timer role, from the timer', async () => {
    const { service, adminInviteService } = build();
    await service.invite(authUser, {
      email: ' New@Example.com ',
      role: 'operator',
    });
    expect(adminInviteService.sendInvitation).toHaveBeenCalledWith(
      authUser,
      { email: 'new@example.com', firstName: undefined, lastName: undefined },
      String(roles['Timer Operator']._id),
      ChurchProduct.SERVICE_TIMER,
    );
  });

  it("won't change the owner, yourself, or someone managed in Church Workflow", async () => {
    const { service } = build();
    for (const target of [owner, me, usher]) {
      await expect(
        service.changeRole(authUser, String(target._id), 'viewer'),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.remove(authUser, String(target._id)),
      ).rejects.toThrow(ForbiddenException);
    }
  });

  it('changes a Timer role through the invite (which emails them) when there is one', async () => {
    const invite = {
      _id: new Types.ObjectId(),
      churchId,
      email: operator.email,
      status: AdminInviteStatus.ACTIVE,
    };
    const { service, adminInviteService, adminModel } = build({
      invites: [invite],
    });
    await service.changeRole(authUser, String(operator._id), 'admin');
    expect(adminInviteService.changeRole).toHaveBeenCalledWith(
      authUser,
      String(invite._id),
      String(roles['Timer Admin']._id),
    );
    expect(adminModel.updateOne).not.toHaveBeenCalled();
  });

  it('changes the account directly when there is no invite', async () => {
    const { service, adminModel } = build();
    await service.changeRole(authUser, String(operator._id), 'viewer');
    expect(adminModel.updateOne).toHaveBeenCalledWith(
      { _id: operator._id },
      { $set: { churchRole: roles['Timer Viewer']._id } },
    );
  });

  it("can't touch another church's invites or people", async () => {
    const otherInvite = {
      _id: new Types.ObjectId(),
      churchId: new Types.ObjectId(),
      email: 'x@y.z',
      status: AdminInviteStatus.PENDING,
    };
    const { service } = build({ invites: [otherInvite] });
    await expect(
      service.resend(authUser, String(otherInvite._id)),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.cancel(authUser, String(otherInvite._id)),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.remove(authUser, String(new Types.ObjectId())),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('invite emails', () => {
  const sent: { to: string; html: string }[] = [];
  const invites = new AdminInviteService(
    {} as any,
    { findById: async () => ({ name: 'Grace Assembly' }) } as any,
    {} as any,
    {
      sendEmail: async (to: string, _s: string, html: string) =>
        sent.push({ to, html }),
    } as any,
    {} as any,
    {} as any,
  );
  const base = {
    churchId,
    email: 'ben@example.com',
    churchRole: 'Timer Operator',
    churchRoleId: roles['Timer Operator']._id,
  };

  beforeAll(() => {
    process.env.INVITE_SECRET = 'test-secret';
    process.env.FRONTEND_URL = 'https://app.churchworkflow.test/';
    process.env.TIMER_FRONTEND_URL = 'https://timer.churchworkflow.test';
  });

  it('timer invites link to the timer, and the token still works', async () => {
    await invites.sendInviteEmail({
      ...base,
      product: ChurchProduct.SERVICE_TIMER,
    });
    const html = sent.pop()!.html;
    const link =
      /https:\/\/timer\.churchworkflow\.test\/accept-invite\?invite=([\w-]+)/.exec(
        html,
      );
    expect(link).not.toBeNull();
    expect(html).toContain('Service Timer');
    expect(decryptInvite(link![1])).toMatchObject({ email: 'ben@example.com' });
  });

  it('Church Workflow invites are unchanged', async () => {
    await invites.sendInviteEmail(base);
    const html = sent.pop()!.html;
    expect(html).toContain(
      'https://app.churchworkflow.test/auth/signup?invite=',
    );
    expect(html).not.toContain('Service Timer');
  });

  it('refuses a timer invite when the timer URL is not configured', async () => {
    delete process.env.TIMER_FRONTEND_URL;
    await expect(
      invites.sendInviteEmail({
        ...base,
        product: ChurchProduct.SERVICE_TIMER,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
