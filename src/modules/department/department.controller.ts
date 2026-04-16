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
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ModuleSections, AccessLevel } from '../../common/utils/enums.utils';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentFilterDto } from './dto/department-filter.dto';
import { UpdateDepartmentMembersDto } from './dto/update-department-members.dto';
import { UpdateDepartmentStatusDto } from './dto/update-department-status.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Post()
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.MANAGE,
  })
  create(@AuthUser() authUser: Admin, @Body() dto: CreateDepartmentDto) {
    return this.departmentService.create(authUser, dto);
  }

  @Get('export')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.VIEW,
  })
  async export(@AuthUser() authUser: Admin, @Res() res: Response) {
    const csvData = await this.departmentService.export(authUser);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=departments.csv',
    );
    return res.status(200).send(csvData);
  }

  @Get()
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.VIEW,
  })
  findAll(@AuthUser() authUser: Admin, @Query() dto: DepartmentFilterDto) {
    return this.departmentService.findAll(authUser, dto);
  }

  @Get(':id')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.VIEW,
  })
  findById(@AuthUser() authUser: Admin, @Param('id') id: string) {
    return this.departmentService.findById(authUser, id);
  }

  @Put(':id')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.MANAGE,
  })
  update(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentService.update(authUser, id, dto);
  }

  @Put(':id/members')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.MANAGE,
  })
  updateMembers(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentMembersDto,
  ) {
    return this.departmentService.updateMembers(authUser, id, dto);
  }

  @Put(':id/status')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.MANAGE,
  })
  updateStatus(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentStatusDto,
  ) {
    return this.departmentService.updateStatus(authUser, id, dto);
  }

  @Delete(':id')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.MANAGE,
  })
  delete(@AuthUser() authUser: Admin, @Param('id') id: string) {
    return this.departmentService.delete(authUser, id);
  }

  @Put(':id/members/remove')
@RequirePermissions({
  section: ModuleSections.DEPARTMENTS,
  level: AccessLevel.MANAGE,
})
removeMembers(
  @AuthUser() authUser: Admin,
  @Param('id') id: string,
  @Body('memberIds') memberIds: string[],
) {
  return this.departmentService.removeMembers(authUser, id, memberIds);
}
}
