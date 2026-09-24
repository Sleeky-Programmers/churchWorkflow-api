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
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CreateTitleDto } from './dto/create-title.dto';
import { UpdateTitleDto } from './dto/update-title.dto';
import { TitleService } from './title.service';

@UseGuards(JwtAuthGuard)
@Controller('titles')
export class TitleController {
  constructor(private readonly titleService: TitleService) {}

  @Get()
  findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pagination =
      page !== undefined || limit !== undefined
        ? {
            page: Math.max(Number(page) || 1, 1),
            limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
          }
        : undefined;

    return this.titleService.findAll(tenant, pagination);
  }

  @Post()
  create(@AuthUser() authUser: Admin, @Body() dto: CreateTitleDto) {
    return this.titleService.create(authUser, dto);
  }

  @Put(':id')
  update(
    @AuthUser() authUser: Admin,
    @Param('id') id: string,
    @Body() dto: UpdateTitleDto,
  ) {
    return this.titleService.update(authUser, id, dto);
  }

  @Delete(':id')
  remove(@AuthUser() authUser: Admin, @Param('id') id: string) {
    return this.titleService.remove(authUser, id);
  }
}
