import { Role } from '../../schemas/role.schema';
import {
  AccessLevel,
  ModuleSections,
  RoleStatus,
} from '../../common/utils/enums.utils';
import {
  hasSufficientAccess,
  isSuperAdminRole,
} from '../../common/utils/permissions.util';
import { TimerSessionDto } from './dto/timer-session.dto';

/**
 * Who is on the other end of a timer connection:
 * - admin: signed in; may control if their role allows it
 * - operator: unlocked with the operator PIN; may control, not manage
 * - display: opened a display link; may only watch
 */
export interface TimerPrincipal {
  kind: 'admin' | 'operator' | 'display';
  churchId: string;
  branchId: string;
  canControl: boolean;
  canManage: boolean;
  adminId?: string;
}

/** The role's Service Timer access. Super Admin has full access; a disabled role has none. */
export function timerAccessFor(role?: Partial<Role> | null): AccessLevel {
  if (!role || role.status === RoleStatus.DISABLED) {
    return AccessLevel.NO_ACCESS;
  }
  if (isSuperAdminRole(role)) {
    return AccessLevel.FULL_ACCESS;
  }
  const entry = role.permissions?.find(
    (p) => p.moduleSection === ModuleSections.SERVICE_TIMER,
  );
  return entry?.accessLevel ?? AccessLevel.NO_ACCESS;
}

export function adminPrincipal(
  level: AccessLevel,
  ids: { churchId: string; branchId: string; adminId: string },
): TimerPrincipal | null {
  if (!hasSufficientAccess(level, AccessLevel.VIEW)) {
    return null;
  }
  return {
    kind: 'admin',
    ...ids,
    canControl: hasSufficientAccess(level, AccessLevel.MANAGE),
    canManage: hasSufficientAccess(level, AccessLevel.FULL_ACCESS),
  };
}

/** Every device for one branch's timer. */
export const branchRoom = (churchId: string, branchId: string) =>
  `timer:${churchId}:${branchId}`;

/** Every device in the church, for church-wide changes such as templates. */
export const churchRoom = (churchId: string) => `timer-church:${churchId}`;

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCK_MS = 5 * 60 * 1000;

/** After a wrong PIN: count it, and lock for a while after too many. */
export function afterFailedPin(attempts: number, now: number) {
  const next = attempts + 1;
  if (next >= MAX_PIN_ATTEMPTS) {
    return {
      failedPinAttempts: 0,
      pinLockedUntil: new Date(now + PIN_LOCK_MS),
    };
  }
  return { failedPinAttempts: next, pinLockedUntil: null };
}

/** Minutes until the PIN unlocks, or 0 if it is not locked. */
export function pinLockMinutesLeft(lockedUntil: Date | null, now: number) {
  if (!lockedUntil || lockedUntil.getTime() <= now) {
    return 0;
  }
  return Math.ceil((lockedUntil.getTime() - now) / 60000);
}

/** Keeps the current index inside the program and trims item text. */
export function tidySession(dto: TimerSessionDto): TimerSessionDto {
  const items = dto.items.map((it) => ({
    id: it.id,
    name: it.name,
    person: it.person ?? '',
    minutes: it.minutes,
  }));
  const maxIndex = Math.max(0, items.length - 1);
  return {
    ...dto,
    items,
    index: Math.min(Math.max(0, dto.index), maxIndex),
    timer: {
      running: dto.timer.running,
      startedAt: dto.timer.running ? (dto.timer.startedAt ?? null) : null,
      elapsedBefore: dto.timer.elapsedBefore,
      extraMs: dto.timer.extraMs,
      firstStartedAt: dto.timer.firstStartedAt ?? null,
    },
    message: { text: dto.message.text, shown: dto.message.shown },
  };
}
