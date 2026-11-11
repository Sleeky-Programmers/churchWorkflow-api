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
  UseGuards,
} from '@nestjs/common';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { AccessLevel, ModuleSections } from '../../common/utils/enums.utils';
import { PastoralService } from './pastoral.service';
import {
  PastoralAlertCategory,
  PastoralAlertSeverity,
} from '../../schemas/pastoral-alert.schema';
import {
  AddPastoralNoteDto,
  UpdatePastoralSettingsDto,
} from './dto/pastoral.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('members/pastoral')
export class PastoralController {
  constructor(private readonly pastoralService: PastoralService) {}

  @Get('dashboard')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  async getDashboard(@CurrentTenant() tenant: TenantContext) {
    return this.pastoralService.getDashboard(tenant);
  }

  @Get('settings')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  async getSettings(@CurrentTenant() tenant: TenantContext) {
    return this.pastoralService.getSettings(tenant.churchId);
  }

  @Put('settings')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  async updateSettings(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdatePastoralSettingsDto,
  ) {
    return this.pastoralService.updateSettings(tenant.churchId, dto);
  }

  @Get('settings/impact')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  async getImpactCounts(
    @CurrentTenant() tenant: TenantContext,
    @Query('needsFollowUpThreshold') needsFollowUpThreshold?: string,
    @Query('atRiskThreshold') atRiskThreshold?: string,
    @Query('inactiveThreshold') inactiveThreshold?: string,
    @Query('trackingMode') trackingMode?: string,
    @Query('countSpecialEvents') countSpecialEvents?: string,
  ) {
    // Optional overrides let the UI preview live counts as sliders move,
    // Before anything is saved.
    const override: Parameters<typeof this.pastoralService.getImpactCounts>[1] =
      {};
    const num = (v?: string) => {
      return v !== undefined && v !== '' && Number.isInteger(Number(v))
        ? Number(v)
        : undefined;
    };

    override.needsFollowUpThreshold = num(needsFollowUpThreshold);
    override.atRiskThreshold = num(atRiskThreshold);
    override.inactiveThreshold = num(inactiveThreshold);
    if (trackingMode) {
      override.trackingMode = trackingMode;
    }
    if (countSpecialEvents !== undefined) {
      override.countSpecialEvents = countSpecialEvents === 'true';
    }

    return this.pastoralService.getImpactCounts(tenant, override);
  }

  @Get('alerts')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  async listAlerts(
    @CurrentTenant() tenant: TenantContext,
    @Query('category') category?: PastoralAlertCategory,
    @Query('includeResolved') includeResolved?: string,
  ) {
    return this.pastoralService.listAlerts(
      tenant,
      category,
      includeResolved === 'true',
    );
  }

  @Put('alerts/:alertId/resolve')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  async resolveAlert(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('alertId') alertId: string,
    @Body('resolved') resolved: boolean = true,
    @Body('outcomeNote') outcomeNote?: string,
  ) {
    // Resolving requires a quick outcome note for accountability; unresolving
    // Does not.
    if (resolved && (!outcomeNote || !outcomeNote.trim())) {
      throw new BadRequestException(
        'An outcome note is required to resolve an alert',
      );
    }

    return this.pastoralService.setResolved(
      tenant.churchId,
      alertId,
      resolved,
      {
        id: authUser._id,
        name: `${authUser.firstName ?? ''} ${authUser.lastName ?? ''}`.trim(),
      },
      outcomeNote,
    );
  }

  @Put('alerts/:alertId/read')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.VIEW,
  })
  async markRead(
    @CurrentTenant() tenant: TenantContext,
    @Param('alertId') alertId: string,
    @Body('read') read: boolean = true,
  ) {
    return this.pastoralService.setRead(tenant.churchId, alertId, read);
  }

  @Post('alerts/:alertId/notes')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  async addNote(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('alertId') alertId: string,
    @Body() dto: AddPastoralNoteDto,
  ) {
    return this.pastoralService.addNote(tenant.churchId, alertId, dto.body, {
      id: authUser._id,
      name: `${authUser.firstName ?? ''} ${authUser.lastName ?? ''}`.trim(),
    });
  }

  @Put('alerts/:alertId/notes/:noteIndex')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  async updateNote(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('alertId') alertId: string,
    @Param('noteIndex') noteIndex: string,
    @Body() dto: AddPastoralNoteDto,
  ) {
    const index = Number(noteIndex);
    if (!Number.isInteger(index) || index < 0) {
      throw new BadRequestException('Invalid note index');
    }
    return this.pastoralService.updateNote(
      tenant.churchId,
      alertId,
      index,
      authUser._id,
      dto.body,
    );
  }

  @Delete('alerts/:alertId/notes/:noteIndex')
  @RequirePermissions({
    section: ModuleSections.MEMBERS,
    level: AccessLevel.MANAGE,
  })
  async deleteNote(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('alertId') alertId: string,
    @Param('noteIndex') noteIndex: string,
  ) {
    const index = Number(noteIndex);
    if (!Number.isInteger(index) || index < 0) {
      throw new BadRequestException('Invalid note index');
    }
    return this.pastoralService.deleteNote(
      tenant.churchId,
      alertId,
      index,
      authUser._id,
    );
  }
}

// Re-export for type consumers
export { PastoralAlertCategory, PastoralAlertSeverity };
