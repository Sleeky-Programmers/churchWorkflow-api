import {
  Controller,
  Get,
  Param,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ActivityLogService } from './activity-log.service';
import { Response } from 'express';
import { Admin } from '../../schemas/admin.schema';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { PaginationBaseDto } from '../../common/helpers/pagination.helper';

@UseGuards(JwtAuthGuard)
@Controller('activity-log')
export class ActivityLogController {
  constructor(private readonly activityLogService: ActivityLogService) {}

  @Get()
  async findAll(
    @AuthUser() authUser: Admin,
    @Query() paginationBaseDto: PaginationBaseDto,
  ) {
    return this.activityLogService.findAll(authUser, paginationBaseDto);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.activityLogService.findById(id);
  }

  @Get('export/csv')
  exportToCSV(@AuthUser() authUser: Admin, @Res() response: Response) {
    return this.activityLogService.exportToCSV(authUser, response);
  }

  @Get('export/pdf')
  exportToPDF(@AuthUser() authUser: Admin, @Res() response: Response) {
    return this.activityLogService.exportToPDF(authUser, response);
  }
}
