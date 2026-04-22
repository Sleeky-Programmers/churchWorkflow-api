import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { MembersService } from './members.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CreateMemberDto } from './dto/create-member.dto';
import { MembersFilterDto } from '../../common/helpers/pagination.helper';
import { UpdateMemberDto } from './dto/update-member.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ModuleSections, AccessLevel } from '../../common/utils/enums.utils';
import {
  MemberAttendanceFilterDto,
  MemberAttendanceStatsFilterDto,
} from './dto/member-attendance-filter.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Post('csv/create')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  @UseInterceptors(FileInterceptor('file'))
  createMembersByCsv(
    @AuthUser() authUser: Admin,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }

    return this.membersService.createMembersByCsv(authUser, file.buffer);
  }

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

  @Get('stats')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getMemberStats(@AuthUser() authUser: Admin) {
    return this.membersService.getMemberStats(authUser);
  }

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

  @Get('all')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  getAllMembersNoPagination(@AuthUser() authUser: Admin) {
    return this.membersService.getAllMembersNoPagination(authUser);
  }
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

  @Delete('/:id')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  deleteMember(@Param('id') id: string) {
    return this.membersService.deleteMember(id);
  }
}
