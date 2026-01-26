import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminInviteService } from './admin-invite.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { CreateAdminInviteDto } from './dto/create-admin-invite.dto';

@UseGuards(JwtAuthGuard)
@Controller('admin-invite')
export class AdminInviteController {
  constructor(private readonly adminInviteService: AdminInviteService) {}

  @Post('/:churchRole')
  async createInvite(
    @AuthUser() authUser: Admin,
    @Body() createAdminInviteDto: CreateAdminInviteDto,
    @Param('churchRole') churchRole: string,
  ) {
    return await this.adminInviteService.sendInvitation(
      authUser,
      createAdminInviteDto,
      churchRole,
    );
  }
}
