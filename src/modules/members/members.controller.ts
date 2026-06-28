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
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { MembersFilterDto } from '../../common/helpers/pagination.helper';
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
  createMembersByCsv(@AuthUser() authUser: Admin, @UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    return this.membersService.createMembersByCsv(authUser, file.buffer);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Post('add')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  addMember(
    @AuthUser() authUser: Admin,
    @Body() createMemberDto: CreateMemberDto,
  ) {
    return this.membersService.addMember(authUser, createMemberDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('stats')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getMemberStats(@AuthUser() authUser: Admin) {
    return this.membersService.getMemberStats(authUser);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get()
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getAllMembers(
    @AuthUser() authUser: Admin,
    @Query() paginationBaseDto: MembersFilterDto,
  ) {
    return this.membersService.getAllMembers(authUser, paginationBaseDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('all')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getAllMembersNoPagination(@AuthUser() authUser: Admin) {
    return this.membersService.getAllMembersNoPagination(authUser);
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
  @Get('/:id')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getMemberById(
    @Param('id') id: string,
    @Query() filterDto: MemberAttendanceFilterDto,
  ): Promise<any> {
    return this.membersService.getMemberById(id, filterDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Put('/:id')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  updateMember(
    @Param('id') id: string,
    @Body() updateMemberDto: UpdateMemberDto,
  ) {
    return this.membersService.updateMember(id, updateMemberDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('/:id/attendance')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getMemberAttendance(
    @Param('id') id: string,
    @Query() filterDto: MemberAttendanceFilterDto,
  ) {
    return this.membersService.getMemberAttendance(id, filterDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Get('/:id/attendance-stats')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getMemberAttendanceStats(
    @Param('id') id: string,
    @Query() filterDto: MemberAttendanceStatsFilterDto,
  ) {
    return this.membersService.getMemberAttendanceStats(id, filterDto);
  }

  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Delete('/:id')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  deleteMember(@Param('id') id: string) {
    return this.membersService.deleteMember(id);
  }
}
