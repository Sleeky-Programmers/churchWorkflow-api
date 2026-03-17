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
import { ChurchServicesService } from './church-services.service';
import { CreateChurchServiceDto } from './dto/create-church-service.dto';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { PaginationBaseDto } from '../../common/helpers/pagination.helper';
import { UpdateChurchServiceDto } from './dto/update-church-service.dto';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { ModuleSections, AccessLevel } from '../../common/utils/enums.utils';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('church-services')
export class ChurchServicesController {
  constructor(private readonly churchServicesService: ChurchServicesService) {}

  @Post()
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.MANAGE,
  })
  createChurchService(
    @Body() createChurchServiceDto: CreateChurchServiceDto,
    @AuthUser() authUser: Admin,
  ) {
    return this.churchServicesService.create(authUser, createChurchServiceDto);
  }

  @Get()
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.VIEW,
  })
  getAllChurchServices(
    @AuthUser() authUser: Admin,
    @Query() paginationBaseDto: PaginationBaseDto,
  ) {
    return this.churchServicesService.findAll(authUser, paginationBaseDto);
  }

  @Get(':id')
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.VIEW,
  })
  getChurchServiceById(@Param('id') id: string) {
    return this.churchServicesService.findById(id);
  }

  @Put(':id')
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.MANAGE,
  })
  updateChurchService(
    @Param('id') id: string,
    @Body() updateChurchServiceDto: UpdateChurchServiceDto,
  ) {
    return this.churchServicesService.update(id, updateChurchServiceDto);
  }

  @Delete(':id')
  @RequirePermissions({
    section: ModuleSections.EVENTS,
    level: AccessLevel.MANAGE,
  })
  deleteChurchService(@Param('id') id: string) {
    return this.churchServicesService.delete(id);
  }
}
