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

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { BranchService } from './branch.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { GrantBranchAccessDto } from './dto/grant-branch-access.dto';
import { UpdateAdminAccessDto } from './dto/update-admin-access.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}

  @Get('me')
  listMine(@CurrentTenant() tenant: TenantContext) {
    return this.branchService.listForTenant(tenant);
  }

  @Get('branch-limit-status')
  async getBranchLimitStatus(@AuthUser() authUser: Admin) {
    const status = await this.branchService.getBranchLimitStatus(authUser);
    return { success: true, data: status };
  }

  @Post()
  create(@AuthUser() authUser: Admin, @Body() dto: CreateBranchDto) {
    return this.branchService.create(authUser, dto);
  }

  @Put(':id')
  update(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchService.update(authUser, id, dto);
  }

  @Get(':id/admins')
  listAdmins(@AuthUser() authUser: Admin, @Param('id') id: string) {
    return this.branchService.listBranchAdmins(authUser, id);
  }

  @Post(':id/access')
  grantAccess(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Body() dto: GrantBranchAccessDto,
  ) {
    return this.branchService.grantAccess(authUser, id, dto.adminId);
  }

  @Delete(':id/access/:adminId')
  revokeAccess(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Param('adminId') adminId: string,
  ) {
    return this.branchService.revokeAccess(authUser, id, adminId);
  }

  @Get('admin/:adminId/access')
  getAdminAccess(
    @AuthUser() authUser: Admin,
    @Param('adminId') adminId: string,
  ) {
    return this.branchService.getAdminAccess(authUser, adminId);
  }

  @Put('admin/:adminId/access')
  setAdminAccess(
    @AuthUser() authUser: Admin,
    @Param('adminId') adminId: string,
    @Body() dto: UpdateAdminAccessDto,
  ) {
    return this.branchService.setAdminAccess(authUser, adminId, dto);
  }
}
