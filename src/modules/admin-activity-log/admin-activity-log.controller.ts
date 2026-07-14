import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminActivityLogService } from './admin-activity-log.service';
import { CreateAdminActivityLogDto } from './dto/create-admin-activity-log.dto';
import { UpdateAdminActivityLogDto } from './dto/update-admin-activity-log.dto';
import { AdminActivityLogFilterDto } from './dto/admin-activity-log-filter.dto';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';

@UseGuards(JwtAuthGuard)
@Controller('admin-activity-log')
export class AdminActivityLogController {
  constructor(
    private readonly adminActivityLogService: AdminActivityLogService,
  ) {}

  @Post()
  async create(
    @AuthUser() user: Admin,
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

  @Get(':id')
  async find(@Param('id') id: string) {
    return this.adminActivityLogService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAdminActivityLogDto,
  ) {
    return this.adminActivityLogService.update(id, dto as any);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.adminActivityLogService.remove(id);
  }
}
