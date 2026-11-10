import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';

import { branchRoom, churchRoom } from './service-timer.access';

/**
 * Pushes changes to every connected device. The gateway hands over its
 * namespace when it starts, so REST changes (settings, templates) reach
 * phones and displays the same way socket changes do. Every message carries
 * the server's clock.
 */
@Injectable()
export class ServiceTimerEvents {
  server: Namespace | null = null;

  emitToBranch(
    churchId: string,
    branchId: string,
    event: string,
    data: object,
  ) {
    this.server
      ?.to(branchRoom(churchId, branchId))
      .emit(event, { ...data, serverNow: Date.now() });
  }

  emitToChurch(churchId: string, event: string, data: object) {
    this.server
      ?.to(churchRoom(churchId))
      .emit(event, { ...data, serverNow: Date.now() });
  }

  /**
   * Drops PIN operators and displays for a branch, e.g. after the PIN or the
   * display link changes. Signed-in admins stay connected.
   */
  async disconnectGuests(churchId: string, branchId: string) {
    if (!this.server) {
      return;
    }
    const sockets = await this.server
      .in(branchRoom(churchId, branchId))
      .fetchSockets();
    for (const s of sockets) {
      if (s.data?.principal?.kind !== 'admin') {
        s.disconnect(true);
      }
    }
  }
}
