import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import {
  CouponFilterDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import { CouponFilter, CouponStatus } from '../../common/utils/enums.utils';
import { Coupon } from '../../schemas/coupon.schema';
import { AdminActivityLogService } from '../admin-activity-log/admin-activity-log.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@Injectable()
export class CouponService {
  constructor(
    @InjectModel(Coupon.name) private couponModel: Model<Coupon>,
    private readonly adminActivityLogService: AdminActivityLogService,
  ) {}

  async create(createDto: CreateCouponDto, adminId: Types.ObjectId) {
    // Check if coupon code exists
    const exists = await this.couponModel
      .findOne({ code: createDto.code })
      .lean();
    if (exists) {
      throw new BadRequestException('Coupon code already exists');
    }

    // Validate date range
    if (createDto.validFrom && createDto.expiryDate) {
      const validFrom = new Date(createDto.validFrom);
      const expiryDate = new Date(createDto.expiryDate);
      if (validFrom >= expiryDate) {
        throw new BadRequestException(
          'Valid from date must be before expiry date',
        );
      }
    }

    // Determine initial status
    let status = CouponStatus.DRAFT;
    if (createDto.status === CouponStatus.PUBLISHED) {
      const now = new Date();
      const validFrom = createDto.validFrom
        ? new Date(createDto.validFrom)
        : now;
      const expiryDate = new Date(createDto.expiryDate);

      if (validFrom <= now && expiryDate > now) {
        status = CouponStatus.ACTIVE;
      } else if (validFrom > now) {
        status = CouponStatus.PUBLISHED;
      }
    }

    const toCreate: any = {
      code: createDto.code.toUpperCase(),
      description: createDto.description,
      type: createDto.type,
      discountType: createDto.discountType,
      discount: createDto.discount,
      validFrom: createDto.validFrom
        ? new Date(createDto.validFrom)
        : new Date(),
      expiryDate: new Date(createDto.expiryDate),
      maxUsage: createDto.maxUsage ?? 0,
      minPlanTier: createDto.minPlanTier,
      excludedPlans: createDto.excludedPlans || [],
      isStackable: createDto.isStackable ?? false,
      isTransferable: createDto.isTransferable ?? false,
      status: status,
      isActive:
        status === CouponStatus.ACTIVE || status === CouponStatus.PUBLISHED,
      createdBy: adminId,
      metadata: createDto.metadata || {},
      isSystemGenerated: createDto.isSystemGenerated ?? false,
    };

    const created = await this.couponModel.create(toCreate);
    const coupon = created.toObject();

    // Log admin activity
    await this.adminActivityLogService.create({
      adminId,
      action: 'CREATE_COUPON',
      details: `Created coupon: ${coupon.code} (${coupon.type})`,
    });

    return coupon;
  }

  async findAll(paginationBaseDto: CouponFilterDto) {
    const { page, limit, search, filter, type, status, sortBy, sortOrder } =
      paginationBaseDto;

    const skip = (page - 1) * limit;
    const query: any = {};

    // Search filter
    if (search) {
      query.$or = [
        { code: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Exclude soft-deleted coupons
    query.deletedAt = { $exists: false };

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Special filters
    switch (filter) {
      case CouponFilter.ACTIVE:
        query.status = { $in: [CouponStatus.ACTIVE, CouponStatus.PUBLISHED] };
        query.isActive = true;
        query.expiryDate = { $gte: now };
        query.$or = [
          { maxUsage: 0 },
          { $expr: { $lt: ['$usageCount', '$maxUsage'] } },
        ];
        break;

      case CouponFilter.INACTIVE:
        query.status = CouponStatus.DISABLED;
        break;

      case CouponFilter.EXPIRED:
        query.status = CouponStatus.EXPIRED;
        query.$or = [
          { expiryDate: { $lt: now } },
          { $expr: { $gte: ['$usageCount', '$maxUsage'] } },
        ];
        break;

      case CouponFilter.EXPIRING_SOON:
        query.status = CouponStatus.EXPIRING_SOON;
        query.expiryDate = { $gte: now, $lte: sevenDaysFromNow };
        break;
    }

    // Sorting
    const sort: any = {};
    if (sortBy) {
      sort[sortBy] = sortOrder === 'DESC' ? -1 : 1;
    } else {
      sort.createdAt = -1;
    }

    const [coupons, itemCount] = await Promise.all([
      this.couponModel
        .find(query)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.couponModel.countDocuments(query),
    ]);

    // Auto-update statuses for coupons (without saving)
    const data = coupons.map((coupon) => {
      const updatedStatus = this.calculateStatus(coupon);
      return {
        id: coupon._id,
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        discountType: coupon.discountType,
        discount: coupon.discount,
        validFrom: coupon.validFrom,
        expiryDate: coupon.expiryDate,
        maxUsage: coupon.maxUsage,
        usageCount: coupon.usageCount ?? 0,
        remainingUses:
          coupon.maxUsage > 0
            ? Math.max(0, coupon.maxUsage - (coupon.usageCount || 0))
            : Infinity,
        status: updatedStatus,
        isActive: coupon.isActive,
        minPlanTier: coupon.minPlanTier,
        excludedPlans: coupon.excludedPlans || [],
        isStackable: coupon.isStackable,
        isTransferable: coupon.isTransferable,
        isSystemGenerated: coupon.isSystemGenerated,
        createdBy: coupon.createdBy,
        createdAt: coupon.createdAt,
        updatedAt: coupon.updatedAt,
        usagePercentage:
          coupon.maxUsage > 0
            ? ((coupon.usageCount || 0) / coupon.maxUsage) * 100
            : 0,
        usageHistory: coupon.usageHistory?.slice(0, 5) || [], // Last 5 usage records
      };
    });

    return {
      data,
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async findOne(id: string): Promise<any> {
    const coupon = await this.couponModel
      .findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .lean();

    if (!coupon || coupon.deletedAt) {
      throw new NotFoundException('Coupon not found');
    }

    const status = this.calculateStatus(coupon);

    return {
      ...coupon,
      status,
      remainingUses:
        coupon.maxUsage > 0
          ? Math.max(0, coupon.maxUsage - (coupon.usageCount || 0))
          : Infinity,
      usagePercentage:
        coupon.maxUsage > 0
          ? ((coupon.usageCount || 0) / coupon.maxUsage) * 100
          : 0,
    } as any; // Or cast to a specific type
  }

  async stats() {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalCoupons,
      activeCoupons,
      expiringSoon,
      totalUsage,
      expiredCoupons,
      draftCoupons,
      usageByType,
    ] = await Promise.all([
      this.couponModel.countDocuments({ deletedAt: { $exists: false } }),
      this.couponModel.countDocuments({
        status: CouponStatus.ACTIVE,
        isActive: true,
        expiryDate: { $gte: now },
        deletedAt: { $exists: false },
        $or: [
          { maxUsage: 0 },
          { $expr: { $lt: ['$usageCount', '$maxUsage'] } },
        ],
      }),
      this.couponModel.countDocuments({
        status: CouponStatus.EXPIRING_SOON,
        expiryDate: { $gte: now, $lte: sevenDaysFromNow },
        deletedAt: { $exists: false },
      }),
      this.couponModel.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        { $group: { _id: null, total: { $sum: '$usageCount' } } },
      ]),
      this.couponModel.countDocuments({
        status: CouponStatus.EXPIRED,
        deletedAt: { $exists: false },
      }),
      this.couponModel.countDocuments({
        status: CouponStatus.DRAFT,
        deletedAt: { $exists: false },
      }),
      this.couponModel.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            totalUsage: { $sum: '$usageCount' },
          },
        },
        { $sort: { count: -1 } },
      ]),
    ]);

    return {
      totalCoupons,
      activeCoupons,
      expiringSoon,
      expiredCoupons,
      draftCoupons,
      totalUsage: totalUsage[0]?.total || 0,
      usageByType: usageByType.map((item) => ({
        type: item._id,
        count: item.count,
        totalUsage: item.totalUsage || 0,
      })),
    };
  }

  async validateCoupon(
    code: string,
    planType?: string,
    churchId?: Types.ObjectId,
  ) {
    if (!code) {
      throw new BadRequestException('Coupon code is required');
    }

    const coupon = await this.couponModel
      .findOne({ code: code.toUpperCase(), deletedAt: { $exists: false } })
      .lean();

    if (!coupon) {
      throw new BadRequestException('Invalid coupon code');
    }

    // Check if coupon is active
    if (!coupon.isActive) {
      throw new BadRequestException('Coupon is not active');
    }

    // Check status
    if (
      [
        CouponStatus.DRAFT,
        CouponStatus.DISABLED,
        CouponStatus.EXPIRED,
      ].includes(coupon.status)
    ) {
      throw new BadRequestException(`Coupon is ${coupon.status.toLowerCase()}`);
    }

    // Check expiry date
    const now = new Date();
    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
      await this.updateStatus(coupon._id, CouponStatus.EXPIRED);
      throw new BadRequestException('Coupon has expired');
    }

    // Check valid from date
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      throw new BadRequestException('Coupon is not yet valid');
    }

    // Check usage limit
    const usage = coupon.usageCount ?? 0;
    if (coupon.maxUsage && coupon.maxUsage > 0 && usage >= coupon.maxUsage) {
      await this.updateStatus(coupon._id, CouponStatus.FULLY_USED);
      throw new BadRequestException('Coupon usage limit reached');
    }

    // Check minimum plan tier
    if (planType && coupon.minPlanTier) {
      const planTiers = ['STARTER', 'GROWTH', 'EXPANSION', 'ENTERPRISE'];
      const couponTierIndex = planTiers.indexOf(coupon.minPlanTier);
      const planTierIndex = planTiers.indexOf(planType as any);

      if (planTierIndex < couponTierIndex) {
        throw new BadRequestException(
          `Coupon requires ${coupon.minPlanTier} plan or higher`,
        );
      }
    }

    // Check excluded plans
    if (planType && coupon.excludedPlans?.includes(planType as any)) {
      throw new BadRequestException(
        `Coupon cannot be used with ${planType} plan`,
      );
    }

    // Check if church already used this coupon
    if (churchId && coupon.usageHistory) {
      const alreadyUsed = coupon.usageHistory.some(
        (usage) => usage.churchId.toString() === churchId.toString(),
      );
      if (alreadyUsed) {
        throw new BadRequestException(
          'This coupon has already been used by your church',
        );
      }
    }

    return coupon;
  }

  async incrementUsage(
    code: string,
    data: {
      churchId: Types.ObjectId;
      subscriptionId: Types.ObjectId;
      planType: string;
      originalAmount: number;
      discountedAmount: number;
    },
  ) {
    if (!code) {
      return null;
    }

    const coupon = await this.couponModel.findOne({ code: code.toUpperCase() });
    if (!coupon) {
      return null;
    }

    // Add usage history
    const historyEntry = {
      churchId: data.churchId,
      subscriptionId: data.subscriptionId,
      appliedAt: new Date(),
      discountApplied: coupon.discount,
      planType: data.planType as any,
      originalAmount: data.originalAmount,
      discountedAmount: data.discountedAmount,
    };

    const updated = await this.couponModel.findOneAndUpdate(
      { code: code.toUpperCase() },
      {
        $inc: { usageCount: 1 },
        $push: { usageHistory: historyEntry },
      },
      { new: true },
    );

    // Update status if fully used
    if (
      updated &&
      updated.maxUsage > 0 &&
      updated.usageCount >= updated.maxUsage
    ) {
      await this.updateStatus(updated._id, CouponStatus.FULLY_USED);
    }

    return updated;
  }

  async update(
    id: string,
    updateDto: UpdateCouponDto,
    adminId: Types.ObjectId,
  ) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon || coupon.deletedAt) {
      throw new NotFoundException('Coupon not found');
    }

    // Check if coupon code is being changed and is unique
    if (updateDto.code && updateDto.code !== coupon.code) {
      const exists = await this.couponModel
        .findOne({ code: updateDto.code, _id: { $ne: id } })
        .lean();
      if (exists) {
        throw new BadRequestException('Coupon code already exists');
      }
      coupon.code = updateDto.code.toUpperCase();
    }

    // Validate date range if both provided
    const validFrom = updateDto.validFrom
      ? new Date(updateDto.validFrom)
      : coupon.validFrom;
    const expiryDate = updateDto.expiryDate
      ? new Date(updateDto.expiryDate)
      : coupon.expiryDate;
    if (validFrom >= expiryDate) {
      throw new BadRequestException(
        'Valid from date must be before expiry date',
      );
    }

    // Update fields
    const fieldsToUpdate = [
      'description',
      'discountType',
      'discount',
      'maxUsage',
      'minPlanTier',
      'excludedPlans',
      'isStackable',
      'isTransferable',
      'metadata',
      'isSystemGenerated',
    ];

    for (const field of fieldsToUpdate) {
      if (updateDto[field] !== undefined) {
        coupon[field] = updateDto[field];
      }
    }

    if (updateDto.validFrom) {
      coupon.validFrom = validFrom;
    }
    if (updateDto.expiryDate) {
      coupon.expiryDate = expiryDate;
    }

    // Handle status update
    if (updateDto.status) {
      coupon.status = updateDto.status;
      coupon.isActive =
        updateDto.status === CouponStatus.ACTIVE ||
        updateDto.status === CouponStatus.PUBLISHED;
    } else {
      // Auto-update status based on dates
      const newStatus = this.calculateStatus(coupon);
      coupon.status = newStatus;
      coupon.isActive =
        newStatus === CouponStatus.ACTIVE ||
        newStatus === CouponStatus.PUBLISHED;
    }

    coupon.updatedBy = adminId;
    await coupon.save();

    // Log admin activity
    await this.adminActivityLogService.create({
      adminId,
      action: 'UPDATE_COUPON',
      details: `Updated coupon: ${coupon.code}`,
    });

    return coupon.toObject();
  }

  async remove(id: string, adminId: Types.ObjectId) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    // Prevent deletion of active coupons with usage
    if (coupon.status === CouponStatus.ACTIVE && coupon.usageCount > 0) {
      throw new BadRequestException(
        'Cannot delete an active coupon that has been used. Consider disabling it instead.',
      );
    }

    // Soft delete
    coupon.deletedAt = new Date();
    coupon.deletedBy = adminId;
    coupon.status = CouponStatus.DISABLED;
    coupon.isActive = false;
    await coupon.save();

    // Log admin activity
    await this.adminActivityLogService.create({
      adminId,
      action: 'DELETE_COUPON',
      details: `Deleted coupon: ${coupon.code}`,
    });

    return {
      message: 'Coupon deleted successfully',
      data: coupon,
    };
  }

  async restore(id: string, adminId: Types.ObjectId) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    if (!coupon.deletedAt) {
      throw new BadRequestException('Coupon is not deleted');
    }

    coupon.deletedAt = undefined;
    coupon.deletedBy = undefined;
    coupon.isActive = true;
    const newStatus = this.calculateStatus(coupon);
    coupon.status = newStatus;
    await coupon.save();

    await this.adminActivityLogService.create({
      adminId,
      action: 'RESTORE_COUPON',
      details: `Restored coupon: ${coupon.code}`,
    });

    return coupon;
  }

  async getUsageHistory(id: string, page: number = 1, limit: number = 20) {
    const coupon = await this.couponModel.findById(id);
    if (!coupon || coupon.deletedAt) {
      throw new NotFoundException('Coupon not found');
    }

    const skip = (page - 1) * limit;
    const history = coupon.usageHistory || [];
    const total = history.length;
    const paginatedHistory = history.slice(skip, skip + limit);

    // Populate church details
    const churchIds = paginatedHistory.map((item) => item.churchId);
    const churches = await this.couponModel.db
      .collection('churches')
      .find({ _id: { $in: churchIds } })
      .project({ _id: 1, name: 1, email: 1 })
      .toArray();

    const churchMap = new Map(churches.map((c) => [c._id.toString(), c]));

    const data = paginatedHistory.map((item) => ({
      churchId: item.churchId,
      churchName: churchMap.get(item.churchId.toString())?.name || 'Unknown',
      churchEmail: churchMap.get(item.churchId.toString())?.email,
      appliedAt: item.appliedAt,
      discountApplied: item.discountApplied,
      planType: item.planType,
      originalAmount: item.originalAmount,
      discountedAmount: item.discountedAmount,
    }));

    return {
      data,
      pagination: paginationMeta({ page, limit, itemCount: total }),
    };
  }

  // Helper Methods
  private calculateStatus(coupon: any): CouponStatus {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (coupon.deletedAt) {
      return CouponStatus.DISABLED;
    }

    if ([CouponStatus.DISABLED, CouponStatus.DRAFT].includes(coupon.status)) {
      return coupon.status;
    }

    // Check usage limit
    if (coupon.maxUsage > 0 && (coupon.usageCount || 0) >= coupon.maxUsage) {
      return CouponStatus.FULLY_USED;
    }

    // Check expiry
    if (coupon.expiryDate && new Date(coupon.expiryDate) < now) {
      return CouponStatus.EXPIRED;
    }

    // Check if expiring soon
    if (coupon.expiryDate && new Date(coupon.expiryDate) <= sevenDaysFromNow) {
      return CouponStatus.EXPIRING_SOON;
    }

    // Check if not yet valid
    if (coupon.validFrom && new Date(coupon.validFrom) > now) {
      return CouponStatus.PUBLISHED;
    }

    return CouponStatus.ACTIVE;
  }

  private async updateStatus(couponId: Types.ObjectId, status: CouponStatus) {
    await this.couponModel.findByIdAndUpdate(couponId, {
      status,
      isActive:
        status === CouponStatus.ACTIVE || status === CouponStatus.PUBLISHED,
    });
  }
}
