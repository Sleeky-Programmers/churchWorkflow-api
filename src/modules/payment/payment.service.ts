import { Model, Types } from 'mongoose';

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { paginationMeta } from '../../common/helpers/pagination.helper';
import {
  PaymentStatus,
  PaymentTimeframe,
} from '../../common/utils/enums.utils';
import { Payment } from '../../schemas/payment.schema';
import { AdminActivityLogService } from '../admin-activity-log/admin-activity-log.service';
import { PaymentFilterDto } from './dto/payment-filter.dto';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
    private adminActivityLogService: AdminActivityLogService,
  ) {}

  async createPayment(paymentData: Partial<Payment>) {
    return await this.paymentModel.create(paymentData);
  }

  async findByReference(reference: string) {
    return await this.paymentModel.findOne({ reference });
  }

  async findByTransactionId(transactionId: string) {
    return await this.paymentModel.findOne({ transactionId });
  }

  async updatePaymentStatus(
    reference: string,
    status: string,
    paidAt?: Date,
    extra: Partial<Payment> = {},
  ) {
    return await this.paymentModel.findOneAndUpdate(
      { reference },
      { status, paidAt, ...extra },
      { new: true },
    );
  }

  async createProviderSubscription(
    reference: string,
    provider: string,
    providerSubscriptionRef: string,
  ) {
    const updated = await this.paymentModel.findOneAndUpdate(
      { reference },
      {
        $set: {
          'metadata.providerSubscription': {
            provider,
            providerSubscriptionRef,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    );

    await this.adminActivityLogService.create({
      action: 'Provider subscription created',
      details: `Provider subscription created: ${providerSubscriptionRef}`,
      plan: updated.plan as any,
    } as any);

    return updated;
  }

  async getChurchPayments(churchId: string) {
    return await this.paymentModel.find({ churchId }).sort({ createdAt: -1 });
  }

  async hasUsedCoupon(churchId: any, couponCode: string) {
    if (!couponCode) {
      return false;
    }

    const payment = await this.paymentModel.findOne({
      churchId,
      'metadata.promoCode': couponCode,
      status: PaymentStatus.SUCCESS,
    });

    return !!payment;
  }

  async findByProviderSubscriptionCode(code: string) {
    if (!code) {
      return null;
    }
    return await this.paymentModel.findOne({
      'metadata.providerSubscription.providerSubscriptionRef.subscription_code':
        code,
    });
  }

  async markProviderSubscriptionCanceled(code: string) {
    if (!code) {
      return null;
    }
    const res = await this.paymentModel.updateMany(
      {
        'metadata.providerSubscription.providerSubscriptionRef.subscription_code':
          code,
      },
      {
        $set: {
          'metadata.providerSubscription.canceled': true,
          autoRenew: false,
        },
      },
    );

    await this.adminActivityLogService.create({
      action: 'Provider subscription cancelled',
      details: `Provider subscription ${code} cancelled`,
    } as any);

    return res;
  }

  async findLatestByChurch(churchId: any) {
    return await this.paymentModel
      .findOne({ churchId })
      .sort({ createdAt: -1 });
  }

  async listPayments(paymentFilterDto?: PaymentFilterDto) {
    const { page, limit, plan, status, timeframe } = paymentFilterDto;
    const skip = (page - 1) * limit;

    const match: any = {};
    if (plan) {
      match.plan = plan;
    }
    if (status) {
      match.status = status;
    }

    if (timeframe) {
      const now = new Date();
      const since = new Date();

      if (timeframe === PaymentTimeframe.WEEK) {
        since.setDate(now.getDate() - 7);
      } else if (timeframe === PaymentTimeframe.MONTH) {
        since.setMonth(now.getMonth() - 1);
      } else if (timeframe === PaymentTimeframe.QUARTER) {
        since.setMonth(now.getMonth() - 3);
      }
      match.createdAt = { $gte: since };
    }

    const pipeline: any[] = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: 'churches',
          localField: 'churchId',
          foreignField: '_id',
          as: 'church',
        },
      },
      {
        $project: {
          transactionId: '$transactionId',
          reference: '$reference',
          churchName: { $arrayElemAt: ['$church.name', 0] },
          plan: '$plan',
          amount: '$amount',
          paymentMethod: '$paymentMethod',
          status: '$status',
          date: '$createdAt',
        },
      },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: 'count' }],
        },
      },
    ];

    const res = await this.paymentModel.aggregate(pipeline as any);
    const data = (res[0]?.data as any[]) || [];
    const itemCount = (res[0]?.totalCount[0]?.count as number) || 0;

    return {
      data,
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async getStats(options?: { timeframe?: PaymentTimeframe | null }) {
    const match: any = {};
    if (options?.timeframe) {
      const now = new Date();
      const since = new Date();

      if (options.timeframe === 'week') {
        since.setDate(now.getDate() - 7);
      } else if (options.timeframe === 'month') {
        since.setMonth(now.getMonth() - 1);
      } else if (options.timeframe === 'quarter') {
        since.setMonth(now.getMonth() - 3);
      }
      match.createdAt = { $gte: since };
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, '$amount', 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] },
          },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, '$amount', 0] },
          },
          successCount: {
            $sum: { $cond: [{ $eq: ['$status', 'SUCCESS'] }, 1, 0] },
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'FAILED'] }, 1, 0] },
          },
          totalCount: { $sum: 1 },
        },
      },
    ];

    const res = await this.paymentModel.aggregate(pipeline as any);
    const agg = res[0] || {
      totalRevenue: 0,
      pendingCount: 0,
      pendingAmount: 0,
      successCount: 0,
      failedCount: 0,
      totalCount: 0,
    };

    const successRate = agg.totalCount
      ? (agg.successCount / agg.totalCount) * 100
      : 0;

    return {
      totalRevenue: agg.totalRevenue || 0,
      pendingCount: agg.pendingCount || 0,
      pendingAmount: agg.pendingAmount || 0,
      successRate: successRate.toFixed(2) + '%',
      failedCount: agg.failedCount || 0,
      totalCount: agg.totalCount || 0,
    };
  }

  async getMRRForChurchIds(churchIds?: Types.ObjectId[]) {
    const match: any = { status: PaymentStatus.SUCCESS };
    if (churchIds && churchIds.length) {
      match.churchId = { $in: churchIds.map((id) => new Types.ObjectId(id)) };
    }

    const pipeline: any[] = [
      { $match: match },
      {
        $group: {
          _id: null,
          monthlyEquivalent: {
            $sum: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$billingCycle', 'MONTHLY'] },
                    then: '$amount',
                  },
                  {
                    case: { $eq: ['$billingCycle', 'YEARLY'] },
                    then: { $divide: ['$amount', 12] },
                  },
                ],
                default: 0,
              },
            },
          },
        },
      },
    ];

    const res = await this.paymentModel.aggregate(pipeline as any);
    return (res[0]?.monthlyEquivalent as number) || 0;
  }

  async getMRRBetween(from?: Date, to?: Date) {
    const match: any = { status: PaymentStatus.SUCCESS };
    if (from || to) {
      match.createdAt = {};
      if (from) {
        match.createdAt.$gte = from;
      }
      if (to) {
        match.createdAt.$lt = to;
      }
    }

    const pipeline: any[] = [
      { $match: match },
      {
        $group: {
          _id: null,
          monthlyEquivalent: {
            $sum: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ['$billingCycle', 'MONTHLY'] },
                    then: '$amount',
                  },
                  {
                    case: { $eq: ['$billingCycle', 'YEARLY'] },
                    then: { $divide: ['$amount', 12] },
                  },
                ],
                default: 0,
              },
            },
          },
        },
      },
    ];

    const res = await this.paymentModel.aggregate(pipeline as any);
    return (res[0]?.monthlyEquivalent as number) || 0;
  }

  async getRevenueBetween(from?: Date, to?: Date) {
    const match: any = { status: PaymentStatus.SUCCESS };
    if (from || to) {
      match.createdAt = {};
      if (from) {
        match.createdAt.$gte = from;
      }
      if (to) {
        match.createdAt.$lt = to;
      }
    }

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
        },
      },
    ];

    const res = await this.paymentModel.aggregate(pipeline as any);
    return (res[0]?.totalRevenue as number) || 0;
  }
}
