import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { AdminService } from '../admin/admin.service';
import { AdminInviteService } from '../admin-invite/admin-invite.service';
import { OtpService } from '../otp/otp.service';
import { Types } from 'mongoose';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Admin } from '../../schemas/admin.schema';
import { CreateSuperAdminDto } from '../admin/dto/create-super-admin.dto';
import { decryptInvite } from '../../common/helpers/crypto.helper';
import { OAuth2Client } from 'google-auth-library';

@Injectable()
export class AuthService {
  constructor(
    private adminService: AdminService,
    private adminInviteService: AdminInviteService,
    private otpService: OtpService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

generateTokens(userId: string) {
  const accessToken = this.jwtService.sign(
    { sub: userId },
    {
      expiresIn: this.configService.getOrThrow('JWT_EXPIRES_IN'),
      secret: this.configService.getOrThrow('JWT_SECRET'),
    },
  );

  const refreshToken = this.jwtService.sign(
    { sub: userId },
    {
      secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.getOrThrow(
        'JWT_REFRESH_EXPIRES_IN',
      ),
    },
  );

  return { accessToken, refreshToken };
}

  
  async saveRefreshToken(userId: Types.ObjectId, refreshToken: string) {
    const hashed = await bcrypt.hash(refreshToken, 10);

    await this.adminService.findByIdAndUpdate(userId, {
      refreshToken: hashed,
    });
  }

  async validateUser(email: string, password: string) {
    const user = await this.adminService.findOne(email);

    if (!user) throw new UnauthorizedException('User not found');

    const isPasswordCorrect = bcrypt.compareSync(password, user.password);

    if (!isPasswordCorrect) {
      throw new UnauthorizedException('Invalid password');
    }

    const { password: _, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  }

  async superAdminRegister(registerDto: CreateSuperAdminDto) {
    const { firstName, lastName, email, password } = registerDto;

    const isExistingAdmin = await this.adminService.findOne(email);
    if (isExistingAdmin) {
      throw new ConflictException('Admin already exists');
    }

    await Promise.all([
      this.adminService.createSuperAdmin({
        firstName,
        lastName,
        email,
        password,
      }),
      this.otpService.create(email),
    ]);

    return {
      message: 'Registration successful. Please verify your email.',
    };
  }

  async adminRegister(
    token: string,
    firstName: string,
    lastName: string,
    password: string,
  ) {
    const { email, title, churchId, churchRoleId } = decryptInvite(token);

    const isExistingAdmin = await this.adminService.findOne(email);
    if (isExistingAdmin) {
      throw new ConflictException('Admin already exists');
    }

    const churchObjectId = new Types.ObjectId(churchId);
    const churchRoleObjectId = new Types.ObjectId(churchRoleId);

    const [admin] = await Promise.all([
      this.adminService.createAdmin(
        { firstName, lastName, email, password },
        churchObjectId,
        churchRoleObjectId,
        title || null,
      ),
      this.adminInviteService.acceptInvitation(email),
    ]);

    const tokens = this.generateTokens(admin._id.toString());
    await this.saveRefreshToken(admin._id, tokens.refreshToken);

    return {
      message: 'Registration successful',
      ...tokens,
    };
  }

  async login(data: any) {
    const tokens = this.generateTokens(data._id);

    await this.saveRefreshToken(data._id, tokens.refreshToken);

    return {
      user: data,
      ...tokens,
    };
  }

  async googleLogin(idToken: string, token?: string) {
    if (!idToken) {
      throw new BadRequestException('ID token is required');
    }

    const clientId = this.configService.get<string>('google.clientId');
    const client = new OAuth2Client(clientId);

    let payload;
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch {
      throw new BadRequestException('Invalid ID token');
    }

    if (!payload?.email) {
      throw new BadRequestException('Email not found');
    }

    const { email, given_name: firstName, family_name: lastName } = payload;

    const existing = await this.adminService.findOne(email);

    if (existing) {
      const tokens = this.generateTokens(existing._id.toString());
      await this.saveRefreshToken(existing._id, tokens.refreshToken);

      const { password: _, ...userWithoutPassword } = existing.toObject();

      return {
        message: 'Login successful',
        user: userWithoutPassword,
        ...tokens,
      };
    }

    const dummyPassword = Math.random().toString(36).slice(-16);

    let admin;

    if (token) {
      const invite = decryptInvite(token);

      if (email !== invite.email) {
        throw new BadRequestException('Email mismatch');
      }

      admin = await this.adminService.createAdmin(
        {
          firstName,
          lastName,
          email,
          password: dummyPassword,
        },
        new Types.ObjectId(invite.churchId),
        new Types.ObjectId(invite.churchRoleId),
        invite.title || null,
      );

      await this.adminInviteService.acceptInvitation(email);
    } else {
      admin = await this.adminService.createSuperAdmin({
        firstName,
        lastName,
        email,
        password: dummyPassword,
      });

      await this.adminService.findOneAndUpdate(email, {
        isVerified: true,
      });
    }

    const tokens = this.generateTokens(admin._id.toString());
    await this.saveRefreshToken(admin._id.toString(), tokens.refreshToken);

    return {
      message: 'Registration successful',
      ...tokens,
    };
  }

 async refreshToken(refreshToken: string) {
  if (!refreshToken) {
    throw new UnauthorizedException('Refresh token missing');
  }

  let payload;
  try {
    payload = this.jwtService.verify(refreshToken, {
      secret: this.configService.getOrThrow('jwt.refreshSecret'),
    });
  } catch {
    throw new UnauthorizedException('Invalid refresh token');
  }

  
  const user = await this.adminService.findByIdForRefreshToken(
    payload.sub,
  );

  if (!user || !user.refreshToken) {
    throw new UnauthorizedException('Access denied');
  }

  const isMatch = await bcrypt.compare(
    refreshToken,
    user.refreshToken,
  );

  if (!isMatch) {
    throw new UnauthorizedException('Invalid refresh token');
  }

  const tokens = this.generateTokens(user._id.toString());

  await this.saveRefreshToken(user._id, tokens.refreshToken);

  return tokens;
}

  async requestOtp(email: string) {
    const user = await this.adminService.findOne(email);

    if (!user) {
      throw new NotFoundException('Admin not found');
    }

    await Promise.all([
      this.adminService.findOneAndUpdate(email, { isVerified: false }),
      this.otpService.create(email),
    ]);

    return { message: 'OTP sent' };
  }

  async verifyOtp(verifyOtpDto: VerifyOtpDto) {
    const { email, otp } = verifyOtpDto;

    const latestOtp = await this.otpService.findLatestByEmail(email);

    if (!latestOtp || latestOtp.isUsed) {
      throw new BadRequestException('Invalid OTP');
    }

    if (latestOtp.otp !== otp || latestOtp.otpExpiry < new Date()) {
      throw new BadRequestException('Expired OTP');
    }

    const [, admin] = await Promise.all([
      this.otpService.markAsUsed(latestOtp._id as any),
      this.adminService.findOneAndUpdate(email, { isVerified: true }),
    ]);

    const tokens = this.generateTokens(admin._id.toString());
    await this.saveRefreshToken(admin._id, tokens.refreshToken);

    return {
      message: 'Email verified',
      ...tokens,
    };
  }

  async resetPassword(authUser: Admin, dto: ResetPasswordDto) {
    const { newPassword, confirmNewPassword } = dto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    await this.adminService.findByIdAndUpdate(authUser._id, {
      password: bcrypt.hashSync(newPassword, 10),
    });

    return { message: 'Password reset successful' };
  }

  async logout(data: any) {
    return this.adminService.findByIdAndUpdate(data._id, {
    refreshToken: null,
  });
}
}


