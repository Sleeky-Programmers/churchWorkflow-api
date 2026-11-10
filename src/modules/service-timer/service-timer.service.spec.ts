import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';

import {
  ForbiddenException,
  HttpException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { MAX_PIN_ATTEMPTS } from './service-timer.access';
import { ServiceTimerService } from './service-timer.service';

const churchId = new Types.ObjectId();
const branchId = new Types.ObjectId();

/** A settings document as Mongoose would return it from findOne().select(). */
function settingsDoc(over: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(),
    churchId,
    branchId,
    displayToken: 'display-token',
    operatorPinHash: bcrypt.hashSync('2468', 4),
    pinVersion: 3,
    failedPinAttempts: 0,
    pinLockedUntil: null,
    ...over,
  };
}

function build(doc: Record<string, unknown> | null) {
  const updates: unknown[] = [];
  const settingsModel = {
    findOne: jest.fn(() => ({ select: jest.fn().mockResolvedValue(doc) })),
    updateOne: jest.fn((_filter, update) => {
      updates.push(update);
      return Promise.resolve({});
    }),
  };
  const service = new ServiceTimerService(
    settingsModel as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    new JwtService({}),
    { get: () => 'test-secret' } as any,
    { disconnectGuests: jest.fn() } as any,
  );
  return { service, settingsModel, updates };
}

describe('operator PIN login', () => {
  it('gives a token that unlocks control of that branch only', async () => {
    const { service } = build(settingsDoc());
    const { operatorToken } = await service.operatorLogin(
      'display-token',
      '2468',
    );
    const principal = await service.verifyOperatorToken(operatorToken);
    expect(principal).toEqual({
      kind: 'operator',
      churchId: String(churchId),
      branchId: String(branchId),
      canControl: true,
      canManage: false,
    });
  });

  it('counts a wrong PIN', async () => {
    const { service, updates } = build(settingsDoc({ failedPinAttempts: 2 }));
    await expect(
      service.operatorLogin('display-token', '0000'),
    ).rejects.toThrow(UnauthorizedException);
    expect(updates).toEqual([
      { $set: { failedPinAttempts: 3, pinLockedUntil: null } },
    ]);
  });

  it('locks the PIN after too many wrong tries', async () => {
    const { service, updates } = build(
      settingsDoc({ failedPinAttempts: MAX_PIN_ATTEMPTS - 1 }),
    );
    await expect(
      service.operatorLogin('display-token', '0000'),
    ).rejects.toThrow();
    const set = (updates[0] as any).$set;
    expect(set.pinLockedUntil).toBeInstanceOf(Date);
  });

  it('refuses even the right PIN while locked', async () => {
    const { service } = build(
      settingsDoc({ pinLockedUntil: new Date(Date.now() + 120_000) }),
    );
    const err = await service
      .operatorLogin('display-token', '2468')
      .catch((e) => e);
    expect(err).toBeInstanceOf(HttpException);
    expect(err.getStatus()).toBe(429);
    expect(err.message).toBe('Too many wrong PINs. Try again in 2 minutes.');
  });

  it('refuses when no PIN has been set', async () => {
    const { service } = build(settingsDoc({ operatorPinHash: null }));
    await expect(
      service.operatorLogin('display-token', '2468'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('stops accepting a token once the PIN or display link changes', async () => {
    const doc = settingsDoc();
    const { service } = build(doc);
    const { operatorToken } = await service.operatorLogin(
      'display-token',
      '2468',
    );
    doc.pinVersion = 4;
    await expect(service.verifyOperatorToken(operatorToken)).rejects.toThrow(
      'The operator PIN or display link has changed. Enter the PIN again.',
    );
  });

  it('rejects an admin access token used as an operator token', async () => {
    const { service } = build(settingsDoc());
    const adminToken = await new JwtService({}).signAsync(
      { sub: 'someone' },
      { secret: 'test-secret' },
    );
    await expect(service.verifyOperatorToken(adminToken)).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
