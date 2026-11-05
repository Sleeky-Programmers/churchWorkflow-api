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
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CommentRequisitionDto } from './dto/comment-requisition.dto';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { RejectRequisitionDto } from './dto/reject-requisition.dto';
import { RequisitionFilterDto } from './dto/requisition-filter.dto';
import { RequisitionService } from './requisition.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('requisitions')
export class RequisitionController {
  constructor(private readonly requisitionService: RequisitionService) {}

  @Post()
  @RequirePermissions({
    section: ModuleSections.REQUESTS,
    level: AccessLevel.MANAGE,
  })
  create(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateRequisitionDto,
  ) {
    return this.requisitionService.create(authUser, tenant, dto);
  }

  @Get()
  @RequirePermissions({
    section: ModuleSections.REQUESTS,
    level: AccessLevel.VIEW,
  })
  findAll(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Query() dto: RequisitionFilterDto,
  ) {
    return this.requisitionService.findAll(authUser, tenant, dto);
  }

  @Get(':id')
  @RequirePermissions({
    section: ModuleSections.REQUESTS,
    level: AccessLevel.VIEW,
  })
  findById(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.requisitionService.findById(authUser, tenant, id);
  }

  @Post(':id/comments')
  @RequirePermissions({
    section: ModuleSections.REQUESTS,
    level: AccessLevel.VIEW,
  })
  addComment(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: CommentRequisitionDto,
  ) {
    return this.requisitionService.addComment(authUser, tenant, id, dto);
  }

  @Put(':id/approve')
  @RequirePermissions({
    section: ModuleSections.REQUESTS,
    level: AccessLevel.FULL_ACCESS,
  })
  approve(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.requisitionService.approve(authUser, tenant, id);
  }

  @Put(':id/reject')
  @RequirePermissions({
    section: ModuleSections.REQUESTS,
    level: AccessLevel.FULL_ACCESS,
  })
  reject(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: RejectRequisitionDto,
  ) {
    return this.requisitionService.reject(authUser, tenant, id, dto);
  }

  @Delete(':id')
  @RequirePermissions({
    section: ModuleSections.REQUESTS,
    level: AccessLevel.MANAGE,
  })
  delete(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.requisitionService.delete(authUser, tenant, id);
  }
}
