import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Coupon } from '../../schemas/coupon.schema';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { CouponFilter, DiscountType } from '../../common/utils/enums.utils';
import {
  CouponFilterDto,
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

  async findAll(paginationBaseDto: CouponFilterDto) {
    const { page, limit, search, filter } = paginationBaseDto;

    const skip = (page - 1) * limit;
    const query: any = {};

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const now = new Date();

    switch (filter) {
      case CouponFilter.ACTIVE:
        query.isActive = true;
        query.$or = [
          { expiryDate: { $exists: false } },
          { expiryDate: { $gte: now } },
        ];
        break;

      case CouponFilter.INACTIVE:
        query.isActive = false;
        break;

      case CouponFilter.EXPIRED:
        query.expiryDate = { $lt: now };
        break;
    }
    const [coupons, itemCount] = await Promise.all([
      this.couponModel.find(query).skip(skip).limit(limit),
      this.couponModel.countDocuments(query),
    ]);
    const data = coupons.map((coupon) => ({
      id: coupon._id,
      code: coupon.code,
      description: coupon.description,
      discountType: coupon.discountType,
      discount: coupon.discount,
      maxUsage: coupon.maxUsage,
      expiryDate: coupon.expiryDate,
      isActive: coupon.isActive,
      usageCount: coupon.usageCount ?? 0,
      createdAt: coupon.createdAt,
      updatedAt: coupon.updatedAt,
    }));

    return {
      data,
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async stats() {
    const now = new Date();
    const expiringSoon = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

    const [totalCoupons, activeCoupons, expiringSoonAgg, totalUsageAgg] =
      await Promise.all([
        this.couponModel.countDocuments(),
        this.couponModel.countDocuments({
          isActive: true,
          expiryDate: { $gt: now },
        }),
        this.couponModel.countDocuments({
          isActive: true,
          expiryDate: { $gte: now, $lte: expiringSoon },
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

  async applyCoupon(code: string, amount: number) {
    const coupon = await this.validateCoupon(code);

    if (!coupon.discountType) {
      throw new BadRequestException('Invalid coupon configuration');
    }

    let discountAmount = 0;

    if (coupon.discountType === DiscountType.PERCENTAGE) {
      discountAmount = Math.round((amount * coupon.discount) / 100);
    } else if (coupon.discountType === DiscountType.FLAT) {
      discountAmount = coupon.discount;
    }

    const finalAmount = Math.max(0, amount - discountAmount);

    return {
      originalAmount: amount,
      finalAmount,
      discountAmount,
      discountValue: coupon.discount,
      discountType: coupon.discountType,
      code: coupon.code,
    };
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

  async update(id: string, updateDto: Partial<CreateCouponDto>) {
    const coupon = await this.couponModel.findById(id);

    if (!coupon) {
      throw new BadRequestException('Coupon not found');
    }

    if (updateDto.code && updateDto.code !== coupon.code) {
      const exists = await this.couponModel
        .findOne({ code: updateDto.code })
        .lean();

      if (exists) {
        throw new BadRequestException('Coupon code already exists');
      }
    }

    if (updateDto.code !== undefined) {
      coupon.code = updateDto.code;
    }
    if (updateDto.description !== undefined) {
      coupon.description = updateDto.description;
    }
    if (updateDto.discountType !== undefined) {
      coupon.discountType = updateDto.discountType;
    }
    if (updateDto.discount !== undefined) {
      coupon.discount = updateDto.discount;
    }
    if (updateDto.maxUsage !== undefined) {
      coupon.maxUsage = updateDto.maxUsage;
    }
    if (updateDto.isActive !== undefined) {
      coupon.isActive = updateDto.isActive;
    }

    if (updateDto.expiryDate) {
      coupon.expiryDate = new Date(updateDto.expiryDate);
    }

    await coupon.save();

    return coupon.toObject();
  }

  async remove(id: string) {
    const deleted = await this.couponModel.findByIdAndDelete(id);

    if (!deleted) {
      throw new BadRequestException('Coupon not found');
    }

    return {
      message: 'Coupon deleted successfully',
    };
  }
}
