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
import { PaginationBaseDto } from '../../common/helpers/pagination.helper';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CreateSmallTeamDto } from './dto/create-small-team.dto';
import { MarkSmallTeamAttendanceDto } from './dto/mark-small-team-attendance.dto';
import { SmallTeamReportQueryDto } from './dto/small-team-report-query.dto';
import { UpdateSmallTeamMembersDto } from './dto/update-small-team-members.dto';
import { UpdateSmallTeamDto } from './dto/update-small-team.dto';
import { SmallTeamsService } from './small-teams.service';

@UseGuards(JwtAuthGuard)
@Controller('small-teams')
export class SmallTeamsController {
  constructor(private readonly smallTeamsService: SmallTeamsService) {}

  @Post()
  create(@AuthUser() authUser: Admin, @Body() dto: CreateSmallTeamDto) {
    return this.smallTeamsService.create(authUser, dto);
  }

  @Get()
  findAll(@AuthUser() authUser: Admin, @Query() dto: PaginationBaseDto) {
    return this.smallTeamsService.findAll(authUser, dto);
  }

  @Get(':id')
  findById(@AuthUser() authUser: Admin, @Param('id') id: string) {
    return this.smallTeamsService.findById(authUser, id);
  }

  @Put(':id')
  update(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Body() dto: UpdateSmallTeamDto,
  ) {
    return this.smallTeamsService.update(authUser, id, dto);
  }

  @Put(':id/members')
  updateMembers(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Body() dto: UpdateSmallTeamMembersDto,
  ) {
    return this.smallTeamsService.updateMembers(authUser, id, dto);
  }

  @Post(':id/attendance')
  markAttendance(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Query('serviceId') serviceId: string,
    @Body() dto: MarkSmallTeamAttendanceDto,
  ) {
    return this.smallTeamsService.markAttendance(authUser, id, serviceId, dto);
  }

  @Get(':id/report')
  getReport(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Query() query: SmallTeamReportQueryDto,
  ) {
    return this.smallTeamsService.getReport(authUser, id, query);
  }

  @Delete(':id')
  delete(@AuthUser() authUser: Admin, @Param('id') id: string) {
    return this.smallTeamsService.delete(authUser, id);
  }
}
