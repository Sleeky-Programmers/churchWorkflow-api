import { Types } from 'mongoose';

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { FileValidationInterceptor } from '../../common/interceptors/file-validation.interceptor';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';
import { ChurchService } from './church.service';
import { BlockChurchDto, UnblockChurchDto } from './dto/block-church.dto';
import { ChurchFilterDto } from './dto/church-filter.dto';
import { ChurchIdentityDto } from './dto/church-identity.dto';
import { UpdateChurchPlanDto } from './dto/update-church-plan.dto';

@Controller('church')
export class ChurchController {
  constructor(private readonly churchService: ChurchService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyChurch(@AuthUser() authUser: Admin) {
    return this.churchService.findCurrentChurch(authUser);
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Get('admin/me')
  getMyAdminChurch(@AuthUser() authUser: Admin) {
    return this.churchService.findCurrentChurch(authUser);
  }

  @UseGuards(ProductAdminJwtAuthGuard)
  @Get()
  getAllChurches(@Query() filter: ChurchFilterDto) {
    return this.churchService.findAll(filter);
  }
  @UseGuards(ProductAdminJwtAuthGuard)
  @Get(':id')
  getChurchById(@Param('id') id: string) {
    return this.churchService.findDetailsById(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post()
  @Roles('Super Admin')
  @UseInterceptors(FileInterceptor('file'), FileValidationInterceptor)
  createChurch(
    @AuthUser() authUser: Admin,
    @Body() churchIdentityDto: ChurchIdentityDto,
    @UploadedFile() file?: any,
  ) {
    return this.churchService.create(authUser, churchIdentityDto, file);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Patch('me')
  @Roles('Super Admin')
  @UseInterceptors(FileInterceptor('file'), FileValidationInterceptor)
  async updateChurch(
    @AuthUser() user: Admin,
    @Body() body: any,
    @UploadedFile() file?: any,
  ) {
    const church = await this.churchService.findCurrentChurch(user);

    return this.churchService.update(church._id, body, file);
  }

  @Post(':churchId/block')
  @UseGuards(ProductAdminJwtAuthGuard)
  async blockChurch(
    @Param('churchId') churchId: string,
    @Body() blockChurchDto: BlockChurchDto,
    @AuthUser() authUser: Admin,
  ) {
    const adminId = authUser.id;
    return await this.churchService.blockChurch(
      new Types.ObjectId(churchId),
      new Types.ObjectId(adminId),
      blockChurchDto,
    );
  }

  @Post(':churchId/unblock')
  @UseGuards(ProductAdminJwtAuthGuard)
  async unblockChurch(
    @Param('churchId') churchId: string,
    @Body() unblockChurchDto: UnblockChurchDto,
    @AuthUser() authUser: Admin,
  ) {
    const adminId = authUser.id;
    return await this.churchService.unblockChurch(
      new Types.ObjectId(churchId),
      new Types.ObjectId(adminId),
      unblockChurchDto,
    );
  }

  @Get(':churchId/block-history')
  @UseGuards(ProductAdminJwtAuthGuard)
  async getBlockHistory(@Param('churchId') churchId: string) {
    return await this.churchService.getBlockHistory(
      new Types.ObjectId(churchId),
    );
  }

  @Patch(':churchId/plan')
  @UseGuards(ProductAdminJwtAuthGuard)
  async updateChurchPlan(
    @Param('churchId') churchId: string,
    @Body() updateChurchPlanDto: UpdateChurchPlanDto,
    @AuthUser() authUser: Admin,
  ) {
    const adminId = authUser.id;
    return await this.churchService.updatePlanByAdmin(
      new Types.ObjectId(churchId),
      new Types.ObjectId(adminId),
      updateChurchPlanDto,
    );
  }
}
