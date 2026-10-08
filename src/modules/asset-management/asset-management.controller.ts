import {
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
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { FileValidationInterceptor } from '../../common/interceptors/file-validation.interceptor';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { AssetManagementService } from './asset-management.service';
import { AssetFilterDto } from './dto/asset-filter.dto';
import { CreateAssetDto } from './dto/create-asset.dto';
import { LogServiceDto } from './dto/log-service.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateMaintenanceNotificationsDto } from './dto/update-maintenance-notifications.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('assets')
export class AssetManagementController {
  constructor(private readonly assetManagementService: AssetManagementService) {}

  @Get()
  @RequirePermissions({ section: ModuleSections.ASSETS, level: AccessLevel.VIEW })
  findAll(@CurrentTenant() tenant: TenantContext, @Query() dto: AssetFilterDto) {
    return this.assetManagementService.findAll(tenant, dto);
  }

  @Get('stats')
  @RequirePermissions({ section: ModuleSections.ASSETS, level: AccessLevel.VIEW })
  stats(@CurrentTenant() tenant: TenantContext) {
    return this.assetManagementService.stats(tenant);
  }

  @Get(':id')
  @RequirePermissions({ section: ModuleSections.ASSETS, level: AccessLevel.VIEW })
  findById(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.assetManagementService.findById(tenant, id);
  }

  @Post()
  @RequirePermissions({ section: ModuleSections.ASSETS, level: AccessLevel.MANAGE })
  create(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateAssetDto,
  ) {
    return this.assetManagementService.create(authUser, tenant, dto);
  }

  @Put(':id')
  @RequirePermissions({ section: ModuleSections.ASSETS, level: AccessLevel.MANAGE })
  update(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateAssetDto,
  ) {
    return this.assetManagementService.update(authUser, tenant, id, dto);
  }

  @Delete(':id')
  @RequirePermissions({
    section: ModuleSections.ASSETS,
    level: AccessLevel.FULL_ACCESS,
  })
  delete(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.assetManagementService.delete(authUser, tenant, id);
  }

  @Post(':id/services')
  @RequirePermissions({ section: ModuleSections.ASSETS, level: AccessLevel.MANAGE })
  logService(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: LogServiceDto,
  ) {
    return this.assetManagementService.logService(authUser, tenant, id, dto);
  }

  @Put(':id/maintenance-notifications')
  @RequirePermissions({ section: ModuleSections.ASSETS, level: AccessLevel.MANAGE })
  updateNotifications(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateMaintenanceNotificationsDto,
  ) {
    return this.assetManagementService.updateNotifications(
      authUser,
      tenant,
      id,
      dto,
    );
  }

  @Post(':id/images')
  @RequirePermissions({ section: ModuleSections.ASSETS, level: AccessLevel.MANAGE })
  @UseInterceptors(FileInterceptor('file'), FileValidationInterceptor)
  uploadImage(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.assetManagementService.uploadImage(authUser, tenant, id, file);
  }

  @Delete(':id/images/:imageId')
  @RequirePermissions({ section: ModuleSections.ASSETS, level: AccessLevel.MANAGE })
  deleteImage(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Param('imageId') imageId: string,
  ) {
    return this.assetManagementService.deleteImage(authUser, tenant, id, imageId);
  }
}
