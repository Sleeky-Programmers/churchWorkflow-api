import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { CouponService } from './coupon.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { PaginationBaseDto } from '../../common/helpers/pagination.helper';

@Controller('coupon')
export class CouponController {
  constructor(private readonly couponService: CouponService) {}

  @Post()
  async create(@Body() body: CreateCouponDto) {
    return this.couponService.create(body);
  }

  @Get()
  async findAll(@Query() paginationBaseDto: PaginationBaseDto) {
    return this.couponService.findAll(paginationBaseDto);
  }

  @Get('stats')
  async stats() {
    return this.couponService.stats();
  }
}
