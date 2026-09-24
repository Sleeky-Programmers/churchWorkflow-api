import {
  Body,
  Controller,
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
import { CheckDuplicateDto } from './dto/check-duplicate.dto';
import { CreateGivingBatchDto } from './dto/create-giving-batch.dto';
import { GivingBatchFilterDto } from './dto/giving-batch-filter.dto';
import { GivingSummaryFilterDto } from './dto/giving-summary-filter.dto';
import { UpdateGivingBatchDto } from './dto/update-giving-batch.dto';
import { VoidGivingBatchDto } from './dto/void-giving-batch.dto';
import { GivingBatchService } from './giving-batch.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('giving-batches')
export class GivingBatchController {
  constructor(private readonly givingBatchService: GivingBatchService) {}

  @Post()
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.MANAGE,
  })
  create(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateGivingBatchDto,
  ) {
    return this.givingBatchService.create(authUser, tenant, dto);
  }

  @Get()
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() dto: GivingBatchFilterDto,
  ) {
    return this.givingBatchService.findAll(tenant, dto);
  }

  @Get('summary')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  summary(
    @CurrentTenant() tenant: TenantContext,
    @Query() dto: GivingSummaryFilterDto,
  ) {
    return this.givingBatchService.summary(tenant, dto);
  }

  @Get('monthly-trend')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  monthlyTrend(@CurrentTenant() tenant: TenantContext) {
    return this.givingBatchService.monthlyTrend(tenant);
  }

  @Get('check-duplicate')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  checkDuplicate(
    @CurrentTenant() tenant: TenantContext,
    @Query() dto: CheckDuplicateDto,
  ) {
    return this.givingBatchService.checkDuplicate(tenant, dto);
  }

  @Get(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  findById(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.givingBatchService.findById(tenant, id);
  }

  @Put(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.MANAGE,
  })
  update(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateGivingBatchDto,
  ) {
    return this.givingBatchService.update(authUser, tenant, id, dto);
  }

  @Post(':id/submit')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.MANAGE,
  })
  submit(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.givingBatchService.submit(authUser, tenant, id);
  }

  @Post(':id/confirm')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  confirm(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.givingBatchService.confirm(authUser, tenant, id);
  }

  @Post(':id/void')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  void_(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: VoidGivingBatchDto,
  ) {
    return this.givingBatchService.void(authUser, tenant, id, dto);
  }
}
