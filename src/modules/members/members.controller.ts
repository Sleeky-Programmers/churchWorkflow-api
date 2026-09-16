import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { MembersFilterDto } from '../../common/helpers/pagination.helper';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';
import { CreateMemberDto } from './dto/create-member.dto';
import {
  MemberAttendanceFilterDto,
  MemberAttendanceStatsFilterDto,
} from './dto/member-attendance-filter.dto';
import { MemberManagementDto } from './dto/member-management.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { MembersService } from './members.service';

@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('csv/create')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  @UseInterceptors(FileInterceptor('file'))
  createMembersByCsv(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    return this.membersService.createMembersByCsv(
      authUser,
      tenant,
      file.buffer,
    );
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('add')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  addMember(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Body() createMemberDto: CreateMemberDto,
  ) {
    return this.membersService.addMember(authUser, tenant, createMemberDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('stats')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getMemberStats(@CurrentTenant() tenant: TenantContext) {
    return this.membersService.getMemberStats(tenant);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get()
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getAllMembers(
    @CurrentTenant() tenant: TenantContext,
    @Query() paginationBaseDto: MembersFilterDto,
  ) {
    return this.membersService.getAllMembers(tenant, paginationBaseDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('all')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getAllMembersNoPagination(@CurrentTenant() tenant: TenantContext) {
    return this.membersService.getAllMembersNoPagination(tenant);
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Get('management')
  async getAllMembersForManagement(
    @AuthUser() user: Admin,
    @Query() filter: MemberManagementDto,
  ) {
    const result = await this.membersService.getAllMembersForManagement(
      user,
      filter,
    );
    return { success: true, ...result };
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Get('management/stats')
  async getMemberManagementStats(@AuthUser() user: Admin) {
    const stats = await this.membersService.getMemberManagementStats(user);
    return { success: true, ...stats };
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Get('management/:id')
  async getMemberDetailsForManagement(
    @AuthUser() user: Admin,
    @Param('id') id: string,
  ) {
    const member = await this.membersService.getMemberDetailsForManagement(
      user,
      id,
    );
    return { success: true, member };
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @UseGuards(ProductAdminJwtAuthGuard)
  @Patch('management/:id/status')
  async updateMemberStatus(
    @AuthUser() user: Admin,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    const result = await this.membersService.updateMemberStatus(
      user,
      id,
      isActive,
    );
    return { success: true, ...result };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('member-limit-status')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  async getMemberLimitStatus(@AuthUser() authUser: Admin) {
    const status = await this.membersService.getMemberLimitStatus(authUser);
    return {
      success: true,
      data: status,
    };
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('/:id')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getMemberById(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() filterDto: MemberAttendanceFilterDto,
  ): Promise<any> {
    return this.membersService.getMemberById(tenant, id, filterDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Put('/:id')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  updateMember(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    return this.membersService.updateMember(tenant, id, updateMemberDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('/:id/attendance')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getMemberAttendance(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() filterDto: MemberAttendanceFilterDto,
  ) {
    return this.membersService.getMemberAttendance(tenant, id, filterDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('/:id/attendance-stats')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getMemberAttendanceStats(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() filterDto: MemberAttendanceStatsFilterDto,
  ) {
    return this.membersService.getMemberAttendanceStats(tenant, id, filterDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Delete('/:id')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  deleteMember(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.membersService.deleteMember(tenant, id);
  }
}
