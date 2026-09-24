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
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
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
    level: AccessLevel.FULL_ACCESS,
  })
  create(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateDepartmentDto,
  ) {
    return this.departmentService.create(authUser, tenant, dto);
  }

  @Get('export')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.VIEW,
  })
  async export(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Res() res: Response,
  ) {
    const workbookBuffer = await this.departmentService.export(
      authUser,
      tenant,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=departments.xlsx',
    );
    return res.status(200).send(Buffer.from(workbookBuffer as ArrayBuffer));
  }

  @Get()
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.VIEW,
  })
  findAll(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Query() dto: DepartmentFilterDto,
  ) {
    return this.departmentService.findAll(authUser, tenant, dto);
  }

  @Get(':id')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.VIEW,
  })
  findById(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.departmentService.findById(tenant, id, authUser);
  }

  @Put(':id')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.MANAGE,
  })
  update(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.departmentService.update(authUser, tenant, id, dto);
  }

  @Put(':id/members')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.MANAGE,
  })
  updateMembers(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentMembersDto,
  ) {
    return this.departmentService.updateMembers(authUser, tenant, id, dto);
  }

  @Put(':id/status')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.MANAGE,
  })
  updateStatus(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentStatusDto,
  ) {
    return this.departmentService.updateStatus(authUser, tenant, id, dto);
  }

  @Delete(':id')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.FULL_ACCESS,
  })
  delete(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.departmentService.delete(authUser, tenant, id);
  }

  @Put(':id/members/remove')
  @RequirePermissions({
    section: ModuleSections.DEPARTMENTS,
    level: AccessLevel.MANAGE,
  })
  removeMembers(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body('memberIds') memberIds: string[],
  ) {
    return this.departmentService.removeMembers(
      authUser,
      tenant,
      id,
      memberIds,
    );
  }
}
