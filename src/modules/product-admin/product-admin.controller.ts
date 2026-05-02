import {
  Controller,
  Post,
  Body,
  BadRequestException,
  UseGuards,
  Get,
  Query,
  Param,
  Patch,
} from '@nestjs/common';
import { ProductAdminService } from './product-admin.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ProductAdminLoginDto } from './dto/login.dto';
import { ProductAdminJwtAuthGuard } from './guard/product-jwt-auth.guard';

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

  // @UseGuards(ProductAdminJwtAuthGuard)
  @Post('invite')
  async invite(@Body() body: { email: string; roleId: string }) {
    const invite = await this.productAdminService.inviteAdmin(
      body.email,
      body.roleId,
    );
    return { message: 'Invite created', invite };
  }

  @Post('accept-invite')
  async acceptInvite(
    @Body() body: { token: string; name: string; password: string },
  ) {
    const created = await this.productAdminService.acceptInvite(
      body.token,
      body.name,
      body.password,
    );

    return {
      message: 'Account created',
      user: created,
    };
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Patch(':id/block')
  async block(@Param('id') id: string) {
    return this.productAdminService.blockAdmin(id);
  }

   @UseGuards(ProductAdminJwtAuthGuard)
  @Patch(':id/unblock')
  async unblock(@Param('id') id: string) {
    return this.productAdminService.unblockAdmin(id);
  }

   @UseGuards(ProductAdminJwtAuthGuard)
  @Get('stats')
  async stats() {
    return this.productAdminService.stats();
  }

   @UseGuards(ProductAdminJwtAuthGuard)
  @Get()
  async list(@Query() query: any) {
    return this.productAdminService.list(query);
  }
}
