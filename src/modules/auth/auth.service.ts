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

@Injectable()
export class AuthService {
  constructor(
    private adminService: AdminService,
    private adminInviteService: AdminInviteService,
    private otpService: OtpService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  generateAccessToken(userId: string) {
    return this.jwtService.sign(
      { sub: userId },
      {
        expiresIn: this.configService.getOrThrow('jwt.expiresIn'),
      },
    );
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

    const { password: _, ...userWithoutPassword } = user.toObject();

    return userWithoutPassword;
  }

  async superAdminRegister(registerDto: CreateSuperAdminDto) {
    const { firstName, lastName, email, password } = registerDto;

    const isExistingAdmin = await this.adminService.findOne(email);

    if (isExistingAdmin) {
      throw new ConflictException('Admin with this email already exists');
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
      message: 'Registration successful. Please, verify your email.',
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
      throw new ConflictException('An admin with this email already exists');
    }

    const churchObjectId = new Types.ObjectId(churchId);
    const churchRoleObjectId = new Types.ObjectId(churchRoleId);

    const [admin, _] = await Promise.all([
      this.adminService.createAdmin(
        {
          firstName,
          lastName,
          email,
          password,
        },
        churchObjectId,
        churchRoleObjectId,
        title || null,
      ),
      await this.adminInviteService.acceptInvitation(email),
    ]);

    return {
      message: 'Registration successful.',
      accessToken: this.generateAccessToken(admin._id.toString()),
    };
  }

  async login(data: any) {
    return {
      user: data,
      accessToken: this.generateAccessToken(data._id),
    };
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
      throw new BadRequestException('Invalid or already used OTP');
    }

    const isOtpValid =
      latestOtp.otp === otp && latestOtp.otpExpiry > new Date();
    if (!isOtpValid) {
      throw new BadRequestException('Expired OTP');
    }

    const [_, admin] = await Promise.all([
      this.otpService.markAsUsed(latestOtp._id as unknown as Types.ObjectId),
      this.adminService.findOneAndUpdate(email, { isVerified: true }),
    ]);

    return {
      message: 'Email verified successfully',
      accessToken: this.generateAccessToken(admin._id as unknown as string),
    };
  }

  async resetPassword(authUser: Admin, resetPasswordDto: ResetPasswordDto) {
    const { newPassword, confirmNewPassword } = resetPasswordDto;

    const isExistingAdmin = await this.adminService.findById(authUser._id);
    if (!isExistingAdmin || !isExistingAdmin.isVerified) {
      throw new NotFoundException(
        'Admin with this email does not exist or is not verified',
      );
    }

    const isPasswordValid = newPassword === confirmNewPassword;
    if (!isPasswordValid) {
      throw new BadRequestException('Passwords do not match');
    }

    await this.adminService.findByIdAndUpdate(authUser._id, {
      password: bcrypt.hashSync(newPassword, 10),
    });
    return { message: 'Password reset successful' };
  }
}
