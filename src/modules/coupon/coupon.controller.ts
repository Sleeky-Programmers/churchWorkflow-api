import { Types } from 'mongoose';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { CouponFilterDto } from 'src/common/helpers/pagination.helper';
import { DefaultProductAdminRoles } from 'src/common/utils/enums.utils';

import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import { ValidateCouponDto } from './dto/validate-coupon.dto';

@UseGuards(ProductAdminJwtAuthGuard, RolesGuard)
@Controller('coupon')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post()
  @Roles(DefaultProductAdminRoles.SUPER_ADMIN)
  async create(@Body() createDto: CreateCouponDto, @Req() req: any) {
    const adminId = req.user._id || req.user.id;
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.couponService.create(createDto, new Types.ObjectId(adminId));
  }

  @Get()
  async findAll(@Query() filterDto: CouponFilterDto) {
    return this.couponService.findAll(filterDto);
  }

  @Get('stats')
  async stats() {
    return this.couponService.stats();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.couponService.findOne(id);
  }

  @Get(':id/usage-history')
  async getUsageHistory(
    @Param('id') id: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.couponService.getUsageHistory(id, page, limit);
  }

  @Post('validate')
  async validateCoupon(@Body() validateDto: ValidateCouponDto) {
    const churchId = validateDto.churchId
      ? new Types.ObjectId(validateDto.churchId)
      : undefined;

    return this.couponService.validateCoupon(
      validateDto.code,
      validateDto.planType,
      churchId,
    );
  }

  @Post('validate/:code')
  async validateCouponByCode(
    @Param('code') code: string,
    @Query('planType') planType?: string,
    @Query('churchId') churchId?: string,
  ) {
    const churchObjectId = churchId ? new Types.ObjectId(churchId) : undefined;
    return this.couponService.validateCoupon(code, planType, churchObjectId);
  }

  @Patch(':id')
  @Roles(DefaultProductAdminRoles.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateDto: UpdateCouponDto,
    @Req() req: any,
  ) {
    const adminId = req.user._id || req.user.id;
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.couponService.update(
      id,
      updateDto,
      new Types.ObjectId(adminId),
    );
  }

  @Patch(':id/toggle-status')
  @Roles(DefaultProductAdminRoles.SUPER_ADMIN)
  async toggleStatus(
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
    @Req() req: any,
  ) {
    const adminId = req.user._id || req.user.id;
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.couponService.update(
      id,
      { isActive },
      new Types.ObjectId(adminId),
    );
  }

  @Delete(':id')
  @Roles(DefaultProductAdminRoles.SUPER_ADMIN)
  async remove(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user._id || req.user.id;
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.couponService.remove(id, new Types.ObjectId(adminId));
  }

  @Post(':id/restore')
  @Roles(DefaultProductAdminRoles.SUPER_ADMIN)
  async restore(@Param('id') id: string, @Req() req: any) {
    const adminId = req.user._id || req.user.id;
    if (!adminId) {
      throw new BadRequestException('Admin ID not found');
    }
    return this.couponService.restore(id, new Types.ObjectId(adminId));
  }
}
