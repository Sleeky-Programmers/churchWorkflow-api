import {
  Body,
  Controller,
  Get,
  HttpCode,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LocalAuthGuard } from './guard/local-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { CreateSuperAdminDto } from '../admin/dto/create-super-admin.dto';
import { decryptInvite } from '../../common/helpers/crypto.helper';
import { AdminRegisterDto } from './dto/admin-register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('preview')
  preview(@Query('token') token: string) {
    const { email, firstName, lastName } = decryptInvite(token);

    return {
      email,
      firstName,
      lastName,
    };
  }

  @Post('google')
  async googleAuth(
    @Body('idToken') idToken: string,
    @Query('token') token?: string,
  ) {
    return this.authService.googleLogin(idToken, token);
  }

  @Post('admin-register')
  adminRegister(
    @Body()
    { firstName, lastName, password }: AdminRegisterDto,
    @Query('token') token: string,
  ) {
    return this.authService.adminRegister(token, firstName, lastName, password);
  }

  @Post('register')
  register(@Body() registerDto: CreateSuperAdminDto) {
    return this.authService.superAdminRegister(registerDto);
  }

  @UseGuards(LocalAuthGuard)
  @Post('login')
  @HttpCode(200)
  async login(@AuthUser() authUser: Admin) {
    return this.authService.login(authUser);
  }

  @Post('request-otp')
  @HttpCode(200)
  requestOtp(@Body('email') email: string) {
    return this.authService.requestOtp(email);
  }

  @Post('verify-otp')
  @HttpCode(200)
  verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(
    @AuthUser() authUser: Admin,
    @Body() resetPasswordDto: ResetPasswordDto,
  ) {
    return this.authService.resetPassword(authUser, resetPasswordDto);
  }

  @Post('refresh-token')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  async changePassword(
    @AuthUser() authUser: Admin,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.resetPassword(authUser, dto);
  }
}
