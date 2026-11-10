import { AddressInfo } from 'net';

import { Types } from 'mongoose';
import { io, Socket } from 'socket.io-client';

import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';

import {
  AccessLevel,
  ModuleSections,
  RoleStatus,
  RoleType,
} from '../../common/utils/enums.utils';
import { AdminService } from '../admin/admin.service';
import { TenantContextService } from '../branch/tenant-context.service';
import { TimerPrincipal } from './service-timer.access';
import { ServiceTimerEvents } from './service-timer.events';
import { ServiceTimerGateway } from './service-timer.gateway';
import { ServiceTimerService } from './service-timer.service';

/**
 * Runs the real gateway over real Socket.IO connections, with the database
 * layer mocked: who may connect, who may change the timer, and that a change
 * reaches every device in the branch (and only that branch).
 */
const SECRET = 'test-secret';
const churchId = new Types.ObjectId();
const branchA = new Types.ObjectId();
const branchB = new Types.ObjectId();

const roleWith = (level: AccessLevel) => ({
  roleName: 'Custom',
  type: RoleType.CUSTOM,
  status: RoleStatus.ACTIVE,
  permissions: [
    { moduleSection: ModuleSections.SERVICE_TIMER, accessLevel: level },
  ],
});

const admins: Record<string, any> = {};
function addAdmin(level: AccessLevel) {
  const _id = new Types.ObjectId();
  admins[String(_id)] = { _id, churchId, churchRole: roleWith(level) };
  return new JwtService({}).sign({ sub: String(_id) }, { secret: SECRET });
}

const session = (origin: string) => ({
  items: [{ id: 'a', name: 'The Word', person: '', minutes: 40 }],
  index: 0,
  timer: { running: true, startedAt: Date.now(), elapsedBefore: 0, extraMs: 0 },
  message: { text: '', shown: false },
  serviceStart: '09:00',
  origin,
});

describe('ServiceTimerGateway', () => {
  let app: INestApplication;
  let url: string;
  const sockets: Socket[] = [];
  let version = 0;

  beforeAll(async () => {
    const events = new ServiceTimerEvents();
    const timerMock = {
      snapshotFor: async (p: TimerPrincipal) => ({
        access: {
          kind: p.kind,
          canControl: p.canControl,
          canManage: p.canManage,
        },
        serverNow: Date.now(),
      }),
      scopeOf: (p: TimerPrincipal) => ({
        churchId: p.churchId,
        branchId: p.branchId,
      }),
      // Like the real service: save, then send to the branch.
      pushSession: async (scope: any, dto: any) => {
        version += 1;
        events.emitToBranch(
          String(scope.churchId),
          String(scope.branchId),
          'session',
          {
            session: { ...dto, version },
          },
        );
        return { version, serverNow: Date.now() };
      },
      findByDisplayToken: async (token: string) => {
        if (token !== 'display-a') {
          throw new Error('This display link is not valid.');
        }
        return { churchId, branchId: branchA };
      },
      verifyOperatorToken: async () => {
        throw new Error(
          'Your operator session has ended. Enter the PIN again.',
        );
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        ServiceTimerGateway,
        { provide: ServiceTimerEvents, useValue: events },
        { provide: ServiceTimerService, useValue: timerMock },
        {
          provide: AdminService,
          useValue: { findById: async (id: any) => admins[String(id)] },
        },
        {
          provide: TenantContextService,
          useValue: {
            resolveTenantContext: async (_admin: any, requested?: string) => ({
              churchId,
              branchId: requested === String(branchB) ? branchB : branchA,
            }),
          },
        },
        { provide: JwtService, useValue: new JwtService({}) },
        { provide: ConfigService, useValue: { get: () => SECRET } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0);
    const { port } = app.getHttpServer().address() as AddressInfo;
    url = `http://127.0.0.1:${port}/service-timer`;
  });

  afterEach(() => {
    sockets.splice(0).forEach((s) => s.disconnect());
  });

  afterAll(async () => {
    await app.close();
  });

  /** Connects and resolves with the first `hello` or `denied`. */
  function connect(auth: Record<string, string>) {
    const s = io(url, { auth, transports: ['websocket'], reconnection: false });
    sockets.push(s);
    return new Promise<{ socket: Socket; event: string; data: any }>(
      (resolve) => {
        s.once('hello', (data) => resolve({ socket: s, event: 'hello', data }));
        s.once('denied', (data) =>
          resolve({ socket: s, event: 'denied', data }),
        );
      },
    );
  }

  const nextEvent = (s: Socket, event: string, ms = 1000) =>
    new Promise<any>((resolve) => {
      const t = setTimeout(() => resolve(null), ms);
      s.once(event, (d) => {
        clearTimeout(t);
        resolve(d);
      });
    });

  it('lets an operator push a change that reaches every device in the branch', async () => {
    const controller = await connect({ token: addAdmin(AccessLevel.MANAGE) });
    const display = await connect({ displayToken: 'display-a' });
    expect(controller.data.access).toEqual({
      kind: 'admin',
      canControl: true,
      canManage: false,
    });
    expect(display.data.access).toEqual({
      kind: 'display',
      canControl: false,
      canManage: false,
    });

    const received = nextEvent(display.socket, 'session');
    const ack = await controller.socket.emitWithAck(
      'session:push',
      session('laptop'),
    );
    expect(ack).toMatchObject({ ok: true, version: expect.any(Number) });

    const msg = await received;
    expect(msg.session.origin).toBe('laptop');
    expect(typeof msg.serverNow).toBe('number');
  });

  it('keeps branches apart', async () => {
    const inA = await connect({ token: addAdmin(AccessLevel.MANAGE) });
    const inB = await connect({
      token: addAdmin(AccessLevel.VIEW),
      branchId: String(branchB),
    });
    const leaked = nextEvent(inB.socket, 'session', 300);
    await inA.socket.emitWithAck('session:push', session('laptop'));
    expect(await leaked).toBeNull();
  });

  it('lets a viewer watch but not change the timer', async () => {
    const viewer = await connect({ token: addAdmin(AccessLevel.VIEW) });
    expect(viewer.data.access.canControl).toBe(false);
    const ack = await viewer.socket.emitWithAck(
      'session:push',
      session('phone'),
    );
    expect(ack).toEqual({
      ok: false,
      error: 'You can view the timer but not change it.',
    });
  });

  it('turns away a display link that is not valid', async () => {
    expect(await connect({ displayToken: 'wrong' })).toMatchObject({
      event: 'denied',
      data: { message: 'This display link is not valid.' },
    });
  });

  it('turns away a user whose role has no timer access', async () => {
    expect(
      await connect({ token: addAdmin(AccessLevel.NO_ACCESS) }),
    ).toMatchObject({
      event: 'denied',
      data: { message: 'You do not have access to the service timer.' },
    });
  });

  it('turns away an expired or forged token', async () => {
    const forged = new JwtService({}).sign(
      { sub: String(new Types.ObjectId()) },
      { secret: 'nope' },
    );
    expect(await connect({ token: forged })).toMatchObject({
      event: 'denied',
      data: { message: 'Your session has expired. Sign in again.' },
    });
  });

  it('rejects a malformed session', async () => {
    const controller = await connect({
      token: addAdmin(AccessLevel.FULL_ACCESS),
    });
    const exception = nextEvent(controller.socket, 'exception');
    controller.socket.emit('session:push', {
      ...session('laptop'),
      index: -1,
      extra: 'x',
    });
    expect(await exception).toMatchObject({ status: 'error' });
  });

  it('tells a device the server time', async () => {
    const display = await connect({ displayToken: 'display-a' });
    const { serverNow } = await display.socket.emitWithAck('time');
    expect(Math.abs(serverNow - Date.now())).toBeLessThan(1000);
  });
});
