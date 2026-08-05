import { AuthUser } from 'src/common/decorators/auth-user.decorator';
import { ProductAdmin } from 'src/schemas/product-admin.schema';

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { ProductAdminLoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateProductAdminDto } from './dto/update-product-admin.dto';
import { ProductAdminJwtAuthGuard } from './guard/product-jwt-auth.guard';
import { ProductAdminService } from './product-admin.service';

@Controller('product-admin')
export class ProductAdminController {
  constructor(private readonly productAdminService: ProductAdminService) {}

  @Post('login')
  async login(@Body() dto: ProductAdminLoginDto) {
    return this.productAdminService.login(dto);
  }

  @Post('refresh-token')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.productAdminService.refreshToken(dto.refreshToken);
  }

  @UseGuards(ProductAdminJwtAuthGuard)
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
  @Get()
  async list(@Query() query: any) {
    return this.productAdminService.list(query);
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Get('profile')
  async getAdminProfile(@AuthUser() authUser: ProductAdmin) {
    return this.productAdminService.findOne(authUser.email);
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Patch('me')
  async updateProfile(
    @AuthUser() authUser: ProductAdmin,
    @Body() dto: UpdateProductAdminDto,
  ) {
    return this.productAdminService.updateAdminProfile(authUser._id, dto);
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Patch('change-password')
  async changePassword(
    @AuthUser() authUser: ProductAdmin,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.productAdminService.resetPassword(authUser, dto);
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
}
