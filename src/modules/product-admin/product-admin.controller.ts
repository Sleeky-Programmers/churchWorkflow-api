import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  Param,
  Patch,
} from '@nestjs/common';
import { ProductAdminService } from './product-admin.service';
import { ProductAdminLoginDto } from './dto/login.dto';
import { ProductAdminJwtAuthGuard } from './guard/product-jwt-auth.guard';
import { RefreshTokenDto } from './dto/refresh-token.dto';

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
