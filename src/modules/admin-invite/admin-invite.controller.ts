import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminInviteService } from './admin-invite.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { CreateAdminInviteDto } from './dto/create-admin-invite.dto';
import { AdminOptions } from '../../common/utils/enums.utils';

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

  @Get()
  async fetchAllInvitations(@AuthUser() authUser: Admin) {
    return await this.adminInviteService.fetchAllInvitations(authUser);
  }

  @Get('user-limit-status')
  async getUserLimitStatus(@AuthUser() authUser: Admin) {
    const status = await this.adminInviteService.getUserLimitStatus(authUser);
    return {
      success: true,
      data: status,
    };
  }

  @Delete('remove/:inviteId')
  async removeUser(
    @AuthUser() authUser: Admin,
    @Body('key') key: string,
    @Param('inviteId') inviteId: string,
  ) {
    return await this.adminInviteService.removeUser(authUser, inviteId, key);
  }

  @Delete('/:inviteId')
  async deleteInvitation(
    @AuthUser() authUser: Admin,
    @Param('inviteId') inviteId: string,
  ) {
    return await this.adminInviteService.deleteInvitation(authUser, inviteId);
  }

  @Put('update/:inviteId')
  async suspendOrRestoreUser(
    @AuthUser() authUser: Admin,
    @Body('option') option: AdminOptions,
    @Param('inviteId') inviteId: string,
  ) {
    return await this.adminInviteService.suspendOrRestoreUser(
      authUser,
      inviteId,
      option,
    );
  }

  @Put('/:inviteId/:churchRole')
  async changeRole(
    @AuthUser() authUser: Admin,
    @Param() { inviteId, churchRole }: { inviteId: string; churchRole: string },
  ) {
    return await this.adminInviteService.changeRole(
      authUser,
      inviteId,
      churchRole,
    );
  }

  @Put('resend/:inviteId')
  async resendInvitation(
    @AuthUser() authUser: Admin,
    @Param('inviteId') inviteId: string,
  ) {
    return await this.adminInviteService.resendInvitation(authUser, inviteId);
  }
}
