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

@UseGuards(JwtAuthGuard)
@Controller('church-services')
export class ChurchServicesController {
  constructor(private readonly churchServicesService: ChurchServicesService) {}

  @Post()
  createChurchService(
    @Body() createChurchServiceDto: CreateChurchServiceDto,
    @AuthUser() authUser: Admin,
  ) {
    return this.churchServicesService.create(authUser, createChurchServiceDto);
  }

  @Get()
  getAllChurchServices(
    @AuthUser() authUser: Admin,
    @Query() paginationBaseDto: PaginationBaseDto,
  ) {
    return this.churchServicesService.findAll(authUser, paginationBaseDto);
  }

  @Get(':id')
  getChurchServiceById(@Param('id') id: string) {
    return this.churchServicesService.findById(id);
  }

  @Put(':id')
  updateChurchService(
    @Param('id') id: string,
    @Body() updateChurchServiceDto: UpdateChurchServiceDto,
  ) {
    return this.churchServicesService.update(id, updateChurchServiceDto);
  }

  @Delete(':id')
  deleteChurchService(@Param('id') id: string) {
    return this.churchServicesService.delete(id);
  }
}
