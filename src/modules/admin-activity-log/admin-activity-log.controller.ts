import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminActivityLogService } from './admin-activity-log.service';
import { CreateAdminActivityLogDto } from './dto/create-admin-activity-log.dto';
import { AdminActivityLogFilterDto } from './dto/admin-activity-log-filter.dto';
import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { ProductAdmin } from '../../schemas/product-admin.schema';

// This is the audit trail for platform/product-admin actions (adminId refs
// ProductAdmin, not per-church Admin). Any authenticated product admin can
// View it (it's a general admin-portal feature, not gated by module
// Permissions) but church-tenant admins can never reach it — and there is
// Deliberately no update/delete route, since an audit log that can be
// Edited or erased after the fact isn't one.
@UseGuards(ProductAdminJwtAuthGuard)
@Controller('admin-activity-log')
export class AdminActivityLogController {
  constructor(
    private readonly adminActivityLogService: AdminActivityLogService,
  ) {}

  @Post()
  async create(
    @AuthUser() user: ProductAdmin,
    @Body() dto: CreateAdminActivityLogDto,
  ) {
    const payload: any = { ...dto };
    if (!payload.adminId && user) {
      payload.adminId = user._id;
    }
    return this.adminActivityLogService.create(payload);
  }

  @Get()
  async list(@Query() filter: AdminActivityLogFilterDto) {
    return this.adminActivityLogService.list(filter);
  }

  @Get('stats')
  async stats() {
    return this.adminActivityLogService.stats();
  }

  @Get(':id')
  async find(@Param('id') id: string) {
    return this.adminActivityLogService.findById(id);
  }
}
