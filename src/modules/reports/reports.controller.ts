import { timingSafeEqual } from 'crypto';
import { Response } from 'express';

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Res,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Admin } from '../../schemas/admin.schema';
import { ReportPeriod } from '../../schemas/report-snapshot.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import {
  ExportReportDto,
  FeedQueryDto,
  SavePreferencesDto,
  SummaryQueryDto,
} from './dto/reports.dto';
import { ReportsDigestService } from './reports.digest.service';
import { ReportsExportService } from './reports.export.service';
import { ReportsService } from './reports.service';

// Every signed-in admin can open reports: what they see is limited to the
// Sections their role allows (see ReportsService.includedDefs).
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: ReportsService,
    private readonly exporter: ReportsExportService,
  ) {}

  @Get('feed')
  feed(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Query() query: FeedQueryDto,
  ) {
    return this.reports.feed(
      authUser,
      tenant,
      query.period as ReportPeriod,
      query.count,
      query.branch,
    );
  }

  @Get('summary')
  summary(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Query() query: SummaryQueryDto,
  ) {
    return this.reports.summary(authUser, tenant, query as any);
  }

  @Get('preferences')
  preferences(@AuthUser() authUser: Admin) {
    return this.reports.getPreferences(authUser);
  }

  @Put('preferences')
  savePreferences(
    @AuthUser() authUser: Admin,
    @Body() dto: SavePreferencesDto,
  ) {
    return this.reports.savePreferences(authUser, dto);
  }

  @Post('export')
  @HttpCode(200)
  async export(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: ExportReportDto,
    @Res() res: Response,
  ) {
    const bundle = await this.reports.buildBundle(authUser, tenant, {
      period: dto.period as ReportPeriod | 'custom' | undefined,
      anchor: dto.anchor,
      from: dto.from,
      to: dto.to,
      sections: dto.sections,
      branch: dto.branch,
    });

    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    if (dto.format === 'xlsx') {
      const file = await this.exporter.toXlsx(bundle);
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${this.exporter.fileName(bundle, 'xlsx')}"`,
      );
      return res.send(file);
    }

    if (dto.format === 'pdf') {
      const file = await this.exporter.toPdf(bundle);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${this.exporter.fileName(bundle, 'pdf')}"`,
      );
      return res.send(file);
    }

    const csv = this.exporter.toCsv(bundle, dto.sections?.[0]);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.exporter.fileName(bundle, 'csv')}"`,
    );
    return res.send(csv);
  }
}

/**
 * Lets an external scheduler (for hosts where in-process cron does not run,
 * such as serverless) trigger the weekly or monthly job. Disabled unless
 * REPORT_CRON_SECRET is set.
 */
@Controller('reports/jobs')
export class ReportsJobsController {
  constructor(private readonly digest: ReportsDigestService) {}

  @Post(':period')
  @HttpCode(200)
  async run(
    @Param('period') period: string,
    @Headers('x-cron-secret') secret?: string,
  ) {
    const expected = process.env.REPORT_CRON_SECRET;
    if (!expected || !secret) {
      throw new ForbiddenException();
    }
    const a = Buffer.from(secret);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException();
    }
    if (period !== 'weekly' && period !== 'monthly') {
      throw new ForbiddenException();
    }
    return this.digest.run(period as ReportPeriod);
  }
}
