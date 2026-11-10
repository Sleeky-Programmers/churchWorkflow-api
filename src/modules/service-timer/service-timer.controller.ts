import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Types } from 'mongoose';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { FileValidationInterceptor } from '../../common/interceptors/file-validation.interceptor';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import {
  SetOperatorPinDto,
  UpdateTimerSettingsDto,
} from './dto/timer-settings.dto';
import { TimerSessionDto } from './dto/timer-session.dto';
import { TimerTemplateDto } from './dto/timer-template.dto';
import { ServiceTimerService } from './service-timer.service';

const VIEW = { section: ModuleSections.SERVICE_TIMER, level: AccessLevel.VIEW };
const MANAGE = {
  section: ModuleSections.SERVICE_TIMER,
  level: AccessLevel.MANAGE,
};
const FULL = {
  section: ModuleSections.SERVICE_TIMER,
  level: AccessLevel.FULL_ACCESS,
};

/**
 * Service Timer for signed-in users. Viewers can read; operators run the
 * timer and edit programs and templates; timer admins also manage the PIN
 * and display link. Everything is for the user's active branch, except
 * templates, which the whole church shares.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('service-timer')
export class ServiceTimerController {
  constructor(private readonly timer: ServiceTimerService) {}

  /** Settings, templates and the live session in one call. */
  @Get('bootstrap')
  @RequirePermissions(VIEW)
  bootstrap(@CurrentTenant() tenant: TenantContext) {
    return this.timer.bootstrap(this.timer.scopeFor(tenant));
  }

  // ---------------------------------------------------------------- settings

  @Get('settings')
  @RequirePermissions(VIEW)
  getSettings(@CurrentTenant() tenant: TenantContext) {
    return this.timer.getSettings(this.timer.scopeFor(tenant));
  }

  @Patch('settings')
  @RequirePermissions(MANAGE)
  updateSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateTimerSettingsDto,
  ) {
    return this.timer.updateSettings(this.timer.scopeFor(tenant), dto);
  }

  @Post('settings/logo')
  @RequirePermissions(MANAGE)
  @UseInterceptors(FileInterceptor('file'), FileValidationInterceptor)
  uploadLogo(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.timer.uploadLogo(this.timer.scopeFor(tenant), file);
  }

  @Delete('settings/logo')
  @RequirePermissions(MANAGE)
  removeLogo(@CurrentTenant() tenant: TenantContext) {
    return this.timer.removeLogo(this.timer.scopeFor(tenant));
  }

  @Put('settings/pin')
  @RequirePermissions(FULL)
  setPin(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: SetOperatorPinDto,
  ) {
    return this.timer.setOperatorPin(this.timer.scopeFor(tenant), dto.pin);
  }

  @Delete('settings/pin')
  @RequirePermissions(FULL)
  clearPin(@CurrentTenant() tenant: TenantContext) {
    return this.timer.clearOperatorPin(this.timer.scopeFor(tenant));
  }

  @Post('settings/display-link/rotate')
  @RequirePermissions(FULL)
  rotateDisplayLink(@CurrentTenant() tenant: TenantContext) {
    return this.timer.rotateDisplayToken(this.timer.scopeFor(tenant));
  }

  // --------------------------------------------------------------- templates

  @Get('templates')
  @RequirePermissions(VIEW)
  listTemplates(@CurrentTenant() tenant: TenantContext) {
    return this.timer.listTemplates(tenant.churchId);
  }

  @Post('templates')
  @RequirePermissions(MANAGE)
  createTemplate(
    @CurrentTenant() tenant: TenantContext,
    @AuthUser() admin: Admin,
    @Body() dto: TimerTemplateDto,
  ) {
    return this.timer.createTemplate(
      tenant.churchId,
      admin._id as Types.ObjectId,
      dto,
    );
  }

  @Put('templates/:id')
  @RequirePermissions(MANAGE)
  updateTemplate(
    @CurrentTenant() tenant: TenantContext,
    @AuthUser() admin: Admin,
    @Param('id') id: string,
    @Body() dto: TimerTemplateDto,
  ) {
    return this.timer.updateTemplate(
      tenant.churchId,
      admin._id as Types.ObjectId,
      id,
      dto,
    );
  }

  @Delete('templates/:id')
  @RequirePermissions(MANAGE)
  deleteTemplate(
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.timer.deleteTemplate(tenant.churchId, id);
  }

  // ----------------------------------------------------------- live session

  @Get('session')
  @RequirePermissions(VIEW)
  getSession(@CurrentTenant() tenant: TenantContext) {
    return this.timer.getSession(this.timer.scopeFor(tenant));
  }

  /** The same as the socket's session:push, for sending queued changes over HTTP. */
  @Put('session')
  @RequirePermissions(MANAGE)
  pushSession(
    @CurrentTenant() tenant: TenantContext,
    @AuthUser() admin: Admin,
    @Body() dto: TimerSessionDto,
  ) {
    return this.timer.pushSession(
      this.timer.scopeFor(tenant),
      dto,
      admin._id as Types.ObjectId,
    );
  }
}
