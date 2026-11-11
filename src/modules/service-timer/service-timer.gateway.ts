import { Types } from 'mongoose';
import type { Namespace, Socket } from 'socket.io';

import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WsException,
} from '@nestjs/websockets';

import { Role } from '../../schemas/role.schema';
import { AdminService } from '../admin/admin.service';
import { TenantContextService } from '../branch/tenant-context.service';
import { TimerSessionDto } from './dto/timer-session.dto';
import {
  ItemRunsDto,
  TimerReportsService,
} from './reports/timer-reports.service';
import {
  adminPrincipal,
  branchRoom,
  churchRoom,
  timerAccessFor,
  TimerPrincipal,
} from './service-timer.access';
import { ServiceTimerEvents } from './service-timer.events';
import { ServiceTimerService } from './service-timer.service';

/** What a client sends when it connects: one of these. */
interface HandshakeAuth {
  /** A signed-in admin's access token, plus the branch they are working in. */
  token?: string;
  branchId?: string;
  /** A token from POST /service-timer/public/:displayToken/operator. */
  operatorToken?: string;
  /** A display link's token: watch only. */
  displayToken?: string;
}

/**
 * Live sync between the control laptop, phones and displays.
 *
 * Connect to the `/service-timer` namespace with `auth` set as above. The
 * server then sends `hello` with the settings, templates, live session and
 * the client's access. After that it sends `session`, `settings` and
 * `templates` whenever they change; every message carries `serverNow` so
 * each device can correct its clock. Controllers send `session:push` with
 * the whole session after each change.
 *
 * Socket.IO pings every 5 seconds, so a phone that slept or lost Wi-Fi is
 * noticed quickly and reconnects as soon as it can (handoff, section 6).
 */
@WebSocketGateway({
  namespace: '/service-timer',
  cors: { origin: true, credentials: true },
  pingInterval: 5000,
  pingTimeout: 10000,
})
export class ServiceTimerGateway implements OnGatewayInit, OnGatewayConnection {
  private readonly logger = new Logger(ServiceTimerGateway.name);

  constructor(
    private readonly timer: ServiceTimerService,
    private readonly events: ServiceTimerEvents,
    private readonly adminService: AdminService,
    private readonly tenantContextService: TenantContextService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly reports: TimerReportsService,
  ) {}

  afterInit(server: Namespace) {
    this.events.server = server;
  }

  async handleConnection(client: Socket) {
    try {
      const principal = await this.authenticate(
        (client.handshake.auth ?? {}) as HandshakeAuth,
      );
      client.data.principal = principal;
      await client.join(branchRoom(principal.churchId, principal.branchId));
      await client.join(churchRoom(principal.churchId));
      client.emit('hello', await this.timer.snapshotFor(principal));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not connect to the timer.';
      client.emit('denied', { message });
      client.disconnect(true);
    }
  }

  private async authenticate(auth: HandshakeAuth): Promise<TimerPrincipal> {
    if (auth.token) {
      return this.authenticateAdmin(auth.token, auth.branchId);
    }
    if (auth.operatorToken) {
      return this.timer.verifyOperatorToken(auth.operatorToken);
    }
    if (auth.displayToken) {
      const doc = await this.timer.findByDisplayToken(auth.displayToken);
      return {
        kind: 'display',
        churchId: String(doc.churchId),
        branchId: String(doc.branchId),
        canControl: false,
        canManage: false,
      };
    }
    throw new Error('Sign in, enter the operator PIN or open a display link.');
  }

  private async authenticateAdmin(token: string, branchId?: string) {
    let payload: { sub?: string; activeBranchId?: string };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      throw new Error('Your session has expired. Sign in again.');
    }
    if (!payload.sub || !Types.ObjectId.isValid(payload.sub)) {
      throw new Error('Your session has expired. Sign in again.');
    }
    const admin = await this.adminService.findById(
      new Types.ObjectId(payload.sub),
    );
    if (!admin?.churchId) {
      throw new Error('Finish setting up your church first.');
    }

    const tenant = await this.tenantContextService.resolveTenantContext(
      admin,
      branchId ?? payload.activeBranchId,
    );
    if (!tenant.branchId) {
      throw new Error(
        'No active branch selected. Switch to a branch and try again.',
      );
    }

    const principal = adminPrincipal(
      timerAccessFor(admin.churchRole as unknown as Role),
      {
        churchId: String(tenant.churchId),
        branchId: String(tenant.branchId),
        adminId: String(admin._id),
      },
    );
    if (!principal) {
      throw new Error('You do not have access to the service timer.');
    }
    return principal;
  }

  /** A controller's whole session after a change. Acks with the new version. */
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new WsException(
          errors
            .flatMap((e) => Object.values(e.constraints ?? {}))
            .join(', ') || 'Invalid session',
        ),
    }),
  )
  @SubscribeMessage('session:push')
  async pushSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: TimerSessionDto,
  ) {
    const p = client.data.principal as TimerPrincipal | undefined;
    if (!p?.canControl) {
      return { ok: false, error: 'You can view the timer but not change it.' };
    }
    try {
      const result = await this.timer.pushSession(
        this.timer.scopeOf(p),
        dto,
        p.adminId ? new Types.ObjectId(p.adminId) : null,
      );
      return { ok: true, ...result };
    } catch (err) {
      this.logger.error('Failed to save timer session', err as Error);
      return {
        ok: false,
        error: 'Could not save the change. It will be sent again.',
      };
    }
  }

  /**
   * How long items actually ran, from the device that moved the timer on
   * (laptop or PIN phone), for service reports. Acks so queued runs are
   * only dropped once saved.
   */
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: () => new WsException('Invalid runs'),
    }),
  )
  @SubscribeMessage('runs:push')
  async pushRuns(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ItemRunsDto,
  ) {
    const p = client.data.principal as TimerPrincipal | undefined;
    if (!p?.canControl) {
      return { ok: false, error: 'Not allowed' };
    }
    try {
      await this.reports.recordRuns(this.timer.scopeOf(p), dto.runs);
      return { ok: true };
    } catch (err) {
      this.logger.error('Failed to save item runs', err as Error);
      return { ok: false, error: 'Could not save. It will be sent again.' };
    }
  }

  /** The server's clock, for devices correcting their own. */
  @SubscribeMessage('time')
  time() {
    return { serverNow: Date.now() };
  }
}
