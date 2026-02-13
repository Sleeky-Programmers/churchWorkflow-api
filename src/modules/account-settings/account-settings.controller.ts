import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AccountSettingsService } from './account-settings.service';
import { AccountSettingsDto } from './dto/account-settings.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('account-settings')
export class AccountSettingsController {
  constructor(
    private readonly accountSettingsService: AccountSettingsService,
  ) {}

  @Get()
  async getAccountSettings(@AuthUser() authUser: Admin) {
    const adminId = authUser._id;

    return this.accountSettingsService.getAccountSettings(adminId);
  }

  @Put()
  async updateAccountSettings(
    @AuthUser() authUser: Admin,
    @Body() dto: AccountSettingsDto,
  ) {
    const adminId = authUser._id;

    return this.accountSettingsService.updateAccountSettings(adminId, dto);
  }
}
