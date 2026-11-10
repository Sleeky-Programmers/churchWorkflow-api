import {
  AccessLevel,
  ModuleSections,
  RoleStatus,
  RoleType,
} from '../../common/utils/enums.utils';
import { TIMER_ROLES } from '../roles/roles.service';
import {
  adminPrincipal,
  afterFailedPin,
  MAX_PIN_ATTEMPTS,
  PIN_LOCK_MS,
  pinLockMinutesLeft,
  tidySession,
  timerAccessFor,
} from './service-timer.access';

const role = (
  permissions: { moduleSection: ModuleSections; accessLevel: AccessLevel }[],
  extra = {},
) =>
  ({
    roleName: 'Custom',
    type: RoleType.CUSTOM,
    status: RoleStatus.ACTIVE,
    permissions,
    ...extra,
  }) as any;

const ids = { churchId: 'c1', branchId: 'b1', adminId: 'a1' };

describe('timer access', () => {
  it('gives Super Admin full access without a timer permission', () => {
    expect(
      timerAccessFor(
        role([], { roleName: 'Super Admin', type: RoleType.SYSTEM }),
      ),
    ).toBe(AccessLevel.FULL_ACCESS);
  });

  it('gives no access to a disabled role, a missing role or a role without the section', () => {
    const timerRole = role([
      {
        moduleSection: ModuleSections.SERVICE_TIMER,
        accessLevel: AccessLevel.FULL_ACCESS,
      },
    ]);
    expect(timerAccessFor({ ...timerRole, status: RoleStatus.DISABLED })).toBe(
      AccessLevel.NO_ACCESS,
    );
    expect(timerAccessFor(null)).toBe(AccessLevel.NO_ACCESS);
    expect(
      timerAccessFor(
        role([
          {
            moduleSection: ModuleSections.MEMBERS,
            accessLevel: AccessLevel.FULL_ACCESS,
          },
        ]),
      ),
    ).toBe(AccessLevel.NO_ACCESS);
  });

  it('maps Timer Admin, Operator and Viewer to manage, control and view', () => {
    const [admin, operator, viewer] = TIMER_ROLES.map((r) =>
      adminPrincipal(
        timerAccessFor(
          role([
            {
              moduleSection: ModuleSections.SERVICE_TIMER,
              accessLevel: r.accessLevel,
            },
          ]),
        ),
        ids,
      ),
    );
    expect(admin).toMatchObject({ canControl: true, canManage: true });
    expect(operator).toMatchObject({ canControl: true, canManage: false });
    expect(viewer).toMatchObject({ canControl: false, canManage: false });
  });

  it('refuses a user without timer access', () => {
    expect(adminPrincipal(AccessLevel.NO_ACCESS, ids)).toBeNull();
  });
});

describe('operator PIN lockout', () => {
  const now = Date.UTC(2026, 10, 9, 9, 0, 0);

  it('counts wrong PINs and locks after the limit', () => {
    let state = { failedPinAttempts: 0, pinLockedUntil: null as Date | null };
    for (let i = 1; i < MAX_PIN_ATTEMPTS; i++) {
      state = afterFailedPin(state.failedPinAttempts, now);
      expect(state).toEqual({ failedPinAttempts: i, pinLockedUntil: null });
    }
    state = afterFailedPin(state.failedPinAttempts, now);
    expect(state.failedPinAttempts).toBe(0);
    expect(state.pinLockedUntil?.getTime()).toBe(now + PIN_LOCK_MS);
  });

  it('reports the minutes left on a lock', () => {
    expect(pinLockMinutesLeft(null, now)).toBe(0);
    expect(pinLockMinutesLeft(new Date(now - 1), now)).toBe(0);
    expect(pinLockMinutesLeft(new Date(now + PIN_LOCK_MS), now)).toBe(5);
    expect(pinLockMinutesLeft(new Date(now + 61_000), now)).toBe(2);
  });
});

describe('tidySession', () => {
  const base = {
    items: [
      { id: 'a', name: 'Prayer', minutes: 8 },
      { id: 'b', name: 'The Word', person: 'Pst. O', minutes: 40 },
    ],
    index: 5,
    timer: {
      running: false,
      startedAt: 123,
      elapsedBefore: 1000,
      extraMs: 60000,
    },
    message: { text: 'Please round off', shown: true },
    serviceStart: '09:00',
    origin: 'device-1',
  };

  it('keeps the current item inside the program', () => {
    expect(tidySession(base).index).toBe(1);
    expect(tidySession({ ...base, items: [], index: 3 }).index).toBe(0);
  });

  it('drops the start moment when the timer is not running', () => {
    expect(tidySession(base).timer.startedAt).toBeNull();
    expect(
      tidySession({ ...base, timer: { ...base.timer, running: true } }).timer
        .startedAt,
    ).toBe(123);
  });

  it('fills in a missing speaker', () => {
    expect(tidySession(base).items[0].person).toBe('');
  });
});
