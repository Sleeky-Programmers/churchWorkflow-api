import { Controller, Get, Delete, Param, Res, UseGuards } from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { Response } from 'express';
import { Admin } from '../../schemas/admin.schema';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  async findAll(@AuthUser() authUser: Admin) {
    return this.activityLogService.findAll(authUser);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.activityLogService.findById(id);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.activityLogService.delete(id);
  }

  @Get('export/csv')
  async exportCSV(@AuthUser() authUser: Admin, @Res() res: Response) {
    const csv = await this.activityLogService.exportToCSV(authUser);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=activity-logs.csv',
    );

    res.send(csv);
  }

  @Get('export/pdf')
  async exportPDF(@AuthUser() authUser: Admin, @Res() res: Response) {
    return this.activityLogService.exportToPDF(authUser, res);
  }
}
