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
import { CreateGivingRecordDto } from './dto/create-giving-record.dto';
import { GivingRecordFilterDto } from './dto/giving-record-filter.dto';
import { GivingSummaryFilterDto } from './dto/giving-summary-filter.dto';
import { UpdateGivingRecordDto } from './dto/update-giving-record.dto';
import { GivingRecordService } from './giving-record.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('giving-records')
export class GivingRecordController {
  constructor(private readonly givingRecordService: GivingRecordService) {}

  @Post()
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.MANAGE,
  })
  upsert(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateGivingRecordDto,
  ) {
    return this.givingRecordService.upsert(authUser, tenant, dto);
  }

  @Get()
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  findAll(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Query() dto: GivingRecordFilterDto,
  ) {
    return this.givingRecordService.findAll(authUser, tenant, dto);
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
    return this.givingRecordService.summary(tenant, dto);
  }

  @Get('monthly-trend')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  monthlyTrend(@CurrentTenant() tenant: TenantContext) {
    return this.givingRecordService.monthlyTrend(tenant);
  }

  @Get(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.VIEW,
  })
  findById(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.givingRecordService.findById(tenant, id);
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
    @Body() dto: UpdateGivingRecordDto,
  ) {
    return this.givingRecordService.update(authUser, tenant, id, dto);
  }

  @Delete(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING,
    level: AccessLevel.FULL_ACCESS,
  })
  delete(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.givingRecordService.delete(authUser, tenant, id);
  }
}
