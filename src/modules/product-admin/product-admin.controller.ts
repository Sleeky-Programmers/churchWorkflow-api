import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { ProductAdminService } from './product-admin.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ProductAdminLoginDto } from './dto/login.dto';

@Controller('product-admin')
export class ProductAdminController {
  constructor(
    private readonly productAdminService: ProductAdminService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  async login(@Body() dto: ProductAdminLoginDto) {
    const user = await this.productAdminService.validateCredentials(
      dto.email,
      dto.password,
    );

    if (!user) {
      throw new BadRequestException('Invalid credentials');
    }

    const payload = { sub: user._id };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('productAdmin.jwtSecret'),
      expiresIn: this.configService.get('productAdmin.jwtExpiresIn'),
    });

    return {
      message: 'Login successful',
      user,
      accessToken,
    };
  }
}
