import * as bcrypt from 'bcryptjs';
import { OAuth2Client } from 'google-auth-library';
import { Types } from 'mongoose';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { decryptInvite } from '../../common/helpers/crypto.helper';
import { Admin } from '../../schemas/admin.schema';
import { AdminInviteService } from '../admin-invite/admin-invite.service';
import { AdminService } from '../admin/admin.service';
import { CreateSuperAdminDto } from '../admin/dto/create-super-admin.dto';
import { EmailService } from '../email/email.service';
import { renderEmailLayout } from '../email/templates/email-layout.template';
import { OtpService } from '../otp/otp.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private adminService: AdminService,
    private adminInviteService: AdminInviteService,
    private otpService: OtpService,
    private emailService: EmailService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  private async sendWelcomeEmail(email: string, firstName?: string) {
    try {
      const frontendUrl = process.env.FRONTEND_URL;
      const link = frontendUrl?.replace(/\/$/, '') || '';

      const html = renderEmailLayout({
        previewText: 'Welcome to Church Workflow!',
        heading: `Welcome to Church Workflow${firstName ? `, ${firstName}` : ''}! 🎉`,
        paragraphs: [
          "We're so glad to have you with us. Your account is ready, and you can now sign in to start managing your church operations, members, and services all in one place.",
        ],
        button: { text: 'Go to Church Workflow', link },
        fineprint:
          'If you have any questions getting started, our support team is happy to help.',
      });

      await this.emailService.sendEmail(
        email,
        'Welcome to Church Workflow 🎉',
        html,
      );
    } catch (err) {
      this.logger.error(`Failed to send welcome email to ${email}`, err as any);
    }
  }

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
        expiresIn: this.configService.getOrThrow('JWT_REFRESH_EXPIRES_IN'),
      },
    );

    return { accessToken, refreshToken };
  }

  async validateUser(email: string, password: string) {
    const user = await this.adminService.findOne(email);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const isPasswordCorrect = bcrypt.compareSync(password, user.password);

    if (!isPasswordCorrect) {
      throw new UnauthorizedException('Invalid password');
    }

    if (!user.isVerified) {
      throw new UnauthorizedException('Email not verified');
    }

    const { password: _, ...userWithoutPassword } = user.toObject();
    return userWithoutPassword;
  }

  async superAdminRegister(registerDto: CreateSuperAdminDto) {
    const { firstName, lastName, email, password } = registerDto;

    const isExistingAdmin = await this.adminService.findOne(email);
    if (isExistingAdmin) {
      throw new ConflictException('Admin with this email already exists');
    }

    await this.adminService.createSuperAdmin({
      firstName,
      lastName,
      email,
      password,
    });

    let otpSent = true;
    try {
      await this.otpService.create(email);
    } catch {
      otpSent = false;
    }

    return {
      message: otpSent
        ? 'Registration successful. Please, verify your email.'
        : 'Registration successful. Unable to send OTP. Please request a new code.',
      otpSent,
    };
  }

  async adminRegister(
    token: string,
    firstName: string,
    lastName: string,
    password: string,
  ) {
    const { email, title, churchId, churchRole } = decryptInvite(token);

    const isExistingAdmin = await this.adminService.findOne(email);
    if (isExistingAdmin) {
      throw new ConflictException('An admin with this email already exists');
    }

    const churchObjectId = new Types.ObjectId(churchId);
    const churchRoleObjectId = new Types.ObjectId(churchRole);

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

    await this.sendWelcomeEmail(email, firstName);

    return {
      message: 'Registration successful',
      ...tokens,
    };
  }

  async login(data: any) {
    const tokens = this.generateTokens(data._id);

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
      throw new BadRequestException('Email not found in Google token');
    }

    const { email, given_name: firstName, family_name: lastName } = payload;

    const existingAdmin = await this.adminService.findOne(email);

    if (existingAdmin) {
      const tokens = this.generateTokens(existingAdmin._id.toString());

      const { password: _, ...userWithoutPassword } = existingAdmin.toObject();

      return {
        message: 'Login successful',
        user: userWithoutPassword,
        ...tokens,
      };
    }

    const dummyPassword =
      Math.random().toString(36).slice(-8) +
      Math.random().toString(36).slice(-8);

    let admin;

    if (token) {
      const invite = decryptInvite(token);

      if (email !== invite.email) {
        throw new BadRequestException(
          'Google email does not match invite email',
        );
      }

      const churchObjectId = new Types.ObjectId(invite.churchId);
      const churchRoleObjectId = new Types.ObjectId(invite.churchRoleId);

      const results = await Promise.all([
        this.adminService.createAdmin(
          {
            firstName,
            lastName,
            email,
            password: dummyPassword,
          },
          churchObjectId,
          churchRoleObjectId,
          invite.title || null,
        ),
        this.adminInviteService.acceptInvitation(email),
      ]);

      admin = results[0];
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

    await this.sendWelcomeEmail(email, firstName);

    return {
      message: 'Registration successful',
      user: admin,
      ...tokens,
    };
  }

  async refreshToken(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }

    let payload: any;

    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const user = await this.adminService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    const tokens = this.generateTokens(user._id.toString());

    return tokens;
  }

  async requestOtp(email: string) {
    const isExistingAdmin = await this.adminService.findOne(email);

    if (!isExistingAdmin) {
      throw new NotFoundException('Admin with this email does not exist');
    }

    await Promise.all([
      this.adminService.findOneAndUpdate(email, { isVerified: false }),
      this.otpService.create(email),
    ]);

    return { message: 'OTP sent successfully' };
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
      this.otpService.markAsUsed(latestOtp._id as unknown as Types.ObjectId),
      this.adminService.findOneAndUpdate(email, { isVerified: true }),
    ]);

    const tokens = this.generateTokens(admin._id.toString());

    await this.sendWelcomeEmail(admin.email, admin.firstName);

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

  async changePassword(authUser: Admin, dto: ChangePasswordDto) {
    const { currentPassword, newPassword, confirmNewPassword } = dto;

    if (newPassword !== confirmNewPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.adminService.findById(authUser._id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isMatch = bcrypt.compareSync(currentPassword, user.password);

    if (!isMatch) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const isSamePassword = bcrypt.compareSync(newPassword, user.password);

    if (isSamePassword) {
      throw new BadRequestException(
        'New password cannot be the same as current password',
      );
    }

    await this.adminService.findByIdAndUpdate(authUser._id, {
      password: bcrypt.hashSync(newPassword, 10),
    });

    return { message: 'Password updated successfully' };
  }
}
