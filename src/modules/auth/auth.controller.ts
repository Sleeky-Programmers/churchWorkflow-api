import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { LocalAuthGuard } from './guard/local-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from './guard/jwt-auth.guard';
import { CreateAdminDto } from '../admin/dto/create-admin.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  register(@Body() registerDto: CreateAdminDto) {
    return this.authService.register(registerDto);
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
}
