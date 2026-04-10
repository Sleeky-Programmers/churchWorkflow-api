import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Coupon } from '../../schemas/coupon.schema';
import { CreateCouponDto } from './dto/create-coupon.dto';
import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';

@Injectable()
export class CouponService {
  constructor(@InjectModel(Coupon.name) private couponModel: Model<Coupon>) {}

  async create(createDto: CreateCouponDto) {
    const exists = await this.couponModel
      .findOne({ code: createDto.code })
      .lean();
    if (exists) {
      throw new BadRequestException('Coupon code already exists');
    }

    const toCreate: any = {
      code: createDto.code,
      description: createDto.description,
      discountType: createDto.discountType,
      discount: createDto.discount,
      maxUsage: createDto.maxUsage ?? 0,
      isActive:
        typeof createDto.isActive === 'boolean' ? createDto.isActive : true,
    };

    if (createDto.expiryDate) {
      toCreate.expiryDate = new Date(createDto.expiryDate);
    }

    const created = await this.couponModel.create(toCreate);
    return created.toObject();
  }

  async findAll(paginationBaseDto: PaginationBaseDto) {
    const { page, limit } = paginationBaseDto;

    const skip = (page - 1) * limit;

    const [coupons, itemCount] = await Promise.all([
      this.couponModel.find().skip(skip).limit(limit),
      this.couponModel.countDocuments(),
    ]);

    const data = coupons.map((c) => ({
      id: c._id,
      code: c.code,
      description: c.description,
      discountType: c.discountType,
      discount: c.discount,
      maxUsage: c.maxUsage,
      expiryDate: c.expiryDate,
      isActive: c.isActive,
      usageCount: c.usageCount ?? 0,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));

    return {
      data,
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async stats() {
    const now = new Date();
    const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [totalCoupons, activeCoupons, expiringSoonAgg, totalUsageAgg] =
      await Promise.all([
        this.couponModel.countDocuments(),
        this.couponModel.countDocuments({ isActive: true }),
        this.couponModel.countDocuments({
          expiryDate: { $gte: now, $lte: soon },
        }),
        this.couponModel.aggregate([
          { $group: { _id: null, total: { $sum: '$usageCount' } } },
        ]),
      ]);

    const totalUsage =
      (totalUsageAgg && totalUsageAgg[0] && totalUsageAgg[0].total) || 0;

    return {
      totalCoupons,
      activeCoupons,
      expiringSoon: expiringSoonAgg,
      totalUsage,
    };
  }

  async validateCoupon(code: string) {
    if (!code) {
      throw new BadRequestException('Coupon code is required');
    }

    const coupon = await this.couponModel.findOne({ code }).lean();

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException('Invalid coupon code');
    }

    if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
      throw new BadRequestException('Coupon has expired');
    }

    const usage = coupon.usageCount ?? 0;
    if (coupon.maxUsage && coupon.maxUsage > 0 && usage >= coupon.maxUsage) {
      throw new BadRequestException('Coupon usage limit reached');
    }

    return coupon;
  }

  async incrementUsage(code: string) {
    if (!code) {
      return null;
    }
    return await this.couponModel.findOneAndUpdate(
      { code },
      { $inc: { usageCount: 1 } },
      { new: true },
    );
  }
}
