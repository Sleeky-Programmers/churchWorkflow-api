import { createHash, randomBytes } from 'crypto';
import { Model, Types } from 'mongoose';

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Admin } from '../../schemas/admin.schema';
import { AuthHandoff } from '../../schemas/auth-handoff.schema';
import { AuthService } from '../auth/auth.service';

/** How long a code works: enough to open a new tab, not to be reused later. */
export const HANDOFF_TTL_MS = 60_000;

const hash = (code: string) => {
  return createHash('sha256').update(code).digest('hex');
};

/**
 * Moving between our apps without signing in again. The app the user is in
 * asks for a code, opens the other app with it, and that app trades it for
 * the user's own tokens, exactly as if they had signed in there.
 */
@Injectable()
export class AuthHandoffService {
  constructor(
    @InjectModel(AuthHandoff.name) private handoffModel: Model<AuthHandoff>,
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    private authService: AuthService,
  ) {}

  async create(admin: Admin, activeBranchId: Types.ObjectId | null) {
    const code = randomBytes(32).toString('base64url');
    await this.handoffModel.create({
      codeHash: hash(code),
      adminId: admin._id,
      activeBranchId,
      expiresAt: new Date(Date.now() + HANDOFF_TTL_MS),
    });
    return { code, expiresIn: HANDOFF_TTL_MS / 1000 };
  }

  /** Trades a code for tokens, once. Any problem reads the same way. */
  async redeem(code: string) {
    const now = new Date();
    const handoff = await this.handoffModel.findOneAndUpdate(
      { codeHash: hash(String(code)), usedAt: null, expiresAt: { $gt: now } },
      { $set: { usedAt: now } },
      { new: true },
    );
    const fail = () => {
      return new UnauthorizedException(
        'This sign-in link has expired or was already used. Please sign in.',
      );
    };
    if (!handoff) {
      throw fail();
    }
    const admin = await this.adminModel.findById(handoff.adminId).lean();
    if (!admin) {
      throw fail();
    }
    const tokens = this.authService.generateTokens(
      String(admin._id),
      handoff.activeBranchId ? String(handoff.activeBranchId) : null,
    );
    // The same shape as POST /auth/login.
    return { user: admin, ...tokens };
  }
}
