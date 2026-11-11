import { Types } from 'mongoose';

import { UnauthorizedException } from '@nestjs/common';

import { AuthHandoffService, HANDOFF_TTL_MS } from './auth-handoff.service';

function setup() {
  const codes: any[] = [];
  const admin = {
    _id: new Types.ObjectId(),
    email: 'ada@example.com',
    firstName: 'Ada',
  };
  const handoffModel = {
    create: async (d: any) => codes.push({ ...d, usedAt: null }),
    // Matches { codeHash, usedAt: null, expiresAt: { $gt } } like MongoDB.
    findOneAndUpdate: async (q: any, u: any) => {
      const h = codes.find(
        (c) =>
          c.codeHash === q.codeHash &&
          c.usedAt === null &&
          c.expiresAt > q.expiresAt.$gt,
      );
      if (h) {
        Object.assign(h, u.$set);
      }
      return h ?? null;
    },
  };
  const adminModel = {
    findById: (id: any) => ({
      lean: async () => (String(id) === String(admin._id) ? admin : null),
    }),
  };
  const authService = {
    generateTokens: jest.fn((sub: string, branch?: string | null) => ({
      accessToken: `access:${sub}:${branch}`,
      refreshToken: `refresh:${sub}:${branch}`,
    })),
  };
  const service = new AuthHandoffService(
    handoffModel as any,
    adminModel as any,
    authService as any,
  );
  return { service, codes, admin, authService };
}

describe('AuthHandoffService', () => {
  it("trades a code for the same user's tokens, on the same branch", async () => {
    const { service, admin, codes } = setup();
    const branch = new Types.ObjectId();
    const { code, expiresIn } = await service.create(admin as any, branch);
    expect(expiresIn).toBe(HANDOFF_TTL_MS / 1000);
    expect(code.length).toBeGreaterThanOrEqual(40);
    // Only a hash is stored.
    expect(codes[0].codeHash).not.toContain(code);

    const res = await service.redeem(code);
    expect(res.user).toBe(admin);
    expect(res.accessToken).toBe(`access:${admin._id}:${branch}`);
  });

  it('works only once', async () => {
    const { service, admin } = setup();
    const { code } = await service.create(admin as any, null);
    await service.redeem(code);
    await expect(service.redeem(code)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('expires, and refuses made-up codes', async () => {
    const { service, admin, codes } = setup();
    const { code } = await service.create(admin as any, null);
    codes[0].expiresAt = new Date(Date.now() - 1);
    await expect(service.redeem(code)).rejects.toThrow(
      'expired or was already used',
    );
    await expect(service.redeem('not-a-code')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
