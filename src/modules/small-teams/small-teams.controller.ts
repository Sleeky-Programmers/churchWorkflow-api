import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PaginationBaseDto } from '../../common/helpers/pagination.helper';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CreateSmallTeamDto } from './dto/create-small-team.dto';
import { MarkSmallTeamAttendanceDto } from './dto/mark-small-team-attendance.dto';
import { SmallTeamReportQueryDto } from './dto/small-team-report-query.dto';
import { UpdateSmallTeamMembersDto } from './dto/update-small-team-members.dto';
import { UpdateSmallTeamDto } from './dto/update-small-team.dto';
import { SmallTeamsService } from './small-teams.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('small-teams')
export class SmallTeamsController {
  constructor(private readonly smallTeamsService: SmallTeamsService) {}

  @Post()
  @RequirePermissions({
    section: ModuleSections.SMALL_TEAMS,
    level: AccessLevel.FULL_ACCESS,
  })
  create(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateSmallTeamDto,
  ) {
    return this.smallTeamsService.create(authUser, tenant, dto);
  }

  @Get()
  @RequirePermissions({
    section: ModuleSections.SMALL_TEAMS,
    level: AccessLevel.VIEW,
  })
  findAll(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Query() dto: PaginationBaseDto,
  ) {
    return this.smallTeamsService.findAll(authUser, tenant, dto);
  }

  @Get(':id')
  @RequirePermissions({
    section: ModuleSections.SMALL_TEAMS,
    level: AccessLevel.VIEW,
  })
  findById(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.smallTeamsService.findById(authUser, tenant, id);
  }

  @Put(':id')
  @RequirePermissions({
    section: ModuleSections.SMALL_TEAMS,
    level: AccessLevel.MANAGE,
  })
  update(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateSmallTeamDto,
  ) {
    return this.smallTeamsService.update(authUser, tenant, id, dto);
  }

  @Put(':id/members')
  @RequirePermissions({
    section: ModuleSections.SMALL_TEAMS,
    level: AccessLevel.MANAGE,
  })
  updateMembers(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateSmallTeamMembersDto,
  ) {
    return this.smallTeamsService.updateMembers(authUser, tenant, id, dto);
  }

  @Post(':id/attendance')
  @RequirePermissions({
    section: ModuleSections.SMALL_TEAMS,
    level: AccessLevel.MANAGE,
  })
  markAttendance(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query('serviceId') serviceId: string,
    @Body() dto: MarkSmallTeamAttendanceDto,
  ) {
    return this.smallTeamsService.markAttendance(
      authUser,
      tenant,
      id,
      serviceId,
      dto,
    );
  }

  @Get(':id/report')
  @RequirePermissions({
    section: ModuleSections.SMALL_TEAMS,
    level: AccessLevel.VIEW,
  })
  getReport(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Query() query: SmallTeamReportQueryDto,
  ) {
    return this.smallTeamsService.getReport(authUser, tenant, id, query);
  }

  @Delete(':id')
  @RequirePermissions({
    section: ModuleSections.SMALL_TEAMS,
    level: AccessLevel.FULL_ACCESS,
  })
  delete(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.smallTeamsService.delete(tenant, id);
  }
}
