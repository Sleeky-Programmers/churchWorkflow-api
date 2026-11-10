import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Types } from 'mongoose';

import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import {
  FileValidationInterceptor,
  FileValidationOptions,
} from '../../../common/interceptors/file-validation.interceptor';
import { TenantContext } from '../../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../../common/utils/enums.utils';
import { Admin } from '../../../schemas/admin.schema';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { IMPORT_MIME_TYPES, TimerImportService } from './timer-import.service';

export class ImportTextDto {
  // Pasted program text, when there's no file.
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  text?: string;
}

/**
 * Smart import: upload a PDF, Word document or photo (or paste text) and
 * get back program items to review. Only signed-in operators and admins
 * can import; each church has a monthly allowance.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('service-timer/imports')
export class TimerImportController {
  constructor(private readonly imports: TimerImportService) {}

  @Get('usage')
  @RequirePermissions({
    section: ModuleSections.SERVICE_TIMER,
    level: AccessLevel.VIEW,
  })
  usage(@CurrentTenant() tenant: TenantContext) {
    return this.imports.usage(tenant.churchId);
  }

  @Post()
  @HttpCode(200)
  @RequirePermissions({
    section: ModuleSections.SERVICE_TIMER,
    level: AccessLevel.MANAGE,
  })
  @FileValidationOptions({ maxSizeMb: 10, allowedMimeTypes: IMPORT_MIME_TYPES })
  @UseInterceptors(FileInterceptor('file'), FileValidationInterceptor)
  extract(
    @CurrentTenant() tenant: TenantContext,
    @AuthUser() admin: Admin,
    @Body() dto: ImportTextDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.imports.extract(tenant.churchId, admin._id as Types.ObjectId, {
      file,
      text: dto.text,
    });
  }
}
