import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Patch,
  Delete,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CouponFilterDto } from '../../common/helpers/pagination.helper';
 import { ProductAdminJwtAuthGuard } from '../product-admin/guard/product-jwt-auth.guard';

 @UseGuards(ProductAdminJwtAuthGuard)
@Controller('coupon')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post()
  async create(@Body() body: CreateCouponDto) {
    return this.couponService.create(body);
  }

  @Get()
  async findAll(@Query() paginationBaseDto: CouponFilterDto) {
    return this.couponService.findAll(paginationBaseDto);
  }

  @Get('stats')
  async stats() {
    return this.couponService.stats();
  }

  @Get('validate')
  async validate(@Query('code') code: string) {
    return this.couponService.validateCoupon(code);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: Partial<CreateCouponDto>,
  ) {
    return this.couponService.update(id, body);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return this.couponService.remove(id);
  }
}
