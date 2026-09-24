import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { paginationMeta } from '../../common/helpers/pagination.helper';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { buildTenantFilter } from '../../common/utils/tenant-filter.util';
import { ModuleSections } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import {
  GivingBatch,
  GivingBatchSource,
  GivingBatchStatus,
} from '../../schemas/giving-batch.schema';
import { GivingEntry } from '../../schemas/giving-entry.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { CheckDuplicateDto } from './dto/check-duplicate.dto';
import { CreateGivingBatchDto } from './dto/create-giving-batch.dto';
import { GivingBatchFilterDto } from './dto/giving-batch-filter.dto';
import { GivingSummaryFilterDto } from './dto/giving-summary-filter.dto';
import { UpdateGivingBatchDto } from './dto/update-giving-batch.dto';
import { VoidGivingBatchDto } from './dto/void-giving-batch.dto';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

@Injectable()
export class GivingBatchService {
  constructor(
    @InjectModel(GivingBatch.name)
    private givingBatchModel: Model<GivingBatch>,
    @InjectModel(GivingEntry.name)
    private givingEntryModel: Model<GivingEntry>,
    private activityLogService: ActivityLogService,
  ) {}

  async create(
    authUser: Admin,
    tenant: TenantContext,
    dto: CreateGivingBatchDto,
  ) {
    const filter = {
      ...buildTenantFilter(tenant),
      churchServiceId: new Types.ObjectId(dto.churchServiceId),
      date: dto.date,
      isVoided: false,
    };

    const existing = await this.givingBatchModel.findOne(filter);
    if (existing) {
      throw new BadRequestException(
        'A giving batch already exists for this service and date',
      );
    }

    const totalAmount = dto.entries.reduce(
      (sum, entry) => sum + (entry.amount || 0),
      0,
    );

    const batch = await this.givingBatchModel.create({
      ...buildTenantFilter(tenant),
      churchServiceId: new Types.ObjectId(dto.churchServiceId),
      date: dto.date,
      countedWith: dto.countedWith || null,
      notes: dto.notes || null,
      status: GivingBatchStatus.DRAFT,
      source: GivingBatchSource.MANUAL,
      recordedBy: authUser._id,
      totalAmount,
    });

    try {
      await this.givingEntryModel.insertMany(
        dto.entries.map((entry) => ({
          batchId: batch._id,
          offeringTypeId: new Types.ObjectId(entry.offeringTypeId),
          currencyCode: entry.currencyCode,
          amount: entry.amount,
          paymentMethod: entry.paymentMethod || undefined,
          note: entry.note || null,
        })),
      );
    } catch (error) {
      // Compensate the batch creation if entry insertion fails - there's no
      // Multi-document transaction here (see module TODO), so this keeps
      // Partial writes from leaving an entry-less batch behind.
      await this.givingBatchModel.deleteOne({ _id: batch._id });
      throw error;
    }

    await this.activityLogService.create(authUser, {
      action: 'Create Giving Batch',
      module: ModuleSections.GIVING,
      details: `Recorded giving batch for ${dto.date}: ${totalAmount}`,
    });

    return this.findById(tenant, batch._id.toString());
  }

  async findAll(tenant: TenantContext, dto: GivingBatchFilterDto) {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      status,
      churchServiceId,
    } = dto;
    const skip = (page - 1) * limit;

    const filter: any = { ...buildTenantFilter(tenant), isVoided: false };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = startDate;
      }
      if (endDate) {
        filter.date.$lte = endDate;
      }
    }
    if (status) {
      filter.status = status;
    }
    if (churchServiceId) {
      filter.churchServiceId = new Types.ObjectId(churchServiceId);
    }

    const [batches, itemCount] = await Promise.all([
      this.givingBatchModel
        .find(filter)
        .populate('churchServiceId', 'title startTime endTime location')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.givingBatchModel.countDocuments(filter),
    ]);

    return {
      data: batches.map((batch) => this.toResponse(batch)),
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async findById(tenant: TenantContext, id: string) {
    const batch = await this.givingBatchModel
      .findOne({ _id: id, ...buildTenantFilter(tenant) })
      .populate('churchServiceId', 'title startTime endTime location')
      .lean();

    if (!batch) {
      throw new NotFoundException('Giving batch not found');
    }

    const entries = await this.givingEntryModel
      .find({ batchId: batch._id })
      .populate('offeringTypeId', 'name')
      .lean();

    return this.toResponse(batch, entries);
  }

  async update(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: UpdateGivingBatchDto,
  ) {
    const batch = await this.givingBatchModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!batch) {
      throw new NotFoundException('Giving batch not found');
    }

    if (batch.status === GivingBatchStatus.CONFIRMED && !dto.editReason) {
      throw new BadRequestException(
        'editReason is required to edit a confirmed batch',
      );
    }

    if (dto.churchServiceId) {
      batch.churchServiceId = new Types.ObjectId(dto.churchServiceId);
    }
    if (dto.date) {
      batch.date = dto.date;
    }
    if (dto.countedWith !== undefined) {
      batch.countedWith = dto.countedWith;
    }
    if (dto.notes !== undefined) {
      batch.notes = dto.notes;
    }
    if (dto.editReason) {
      batch.editReason = dto.editReason;
    }

    if (dto.entries) {
      // Mirrors the deleteMany-then-bulkCreate replace pattern for entries -
      // Simpler and safer than diffing individual entry rows.
      await this.givingEntryModel.deleteMany({ batchId: batch._id });
      await this.givingEntryModel.insertMany(
        dto.entries.map((entry) => ({
          batchId: batch._id,
          offeringTypeId: new Types.ObjectId(entry.offeringTypeId),
          currencyCode: entry.currencyCode,
          amount: entry.amount,
          paymentMethod: entry.paymentMethod || undefined,
          note: entry.note || null,
        })),
      );
      batch.totalAmount = dto.entries.reduce(
        (sum, entry) => sum + (entry.amount || 0),
        0,
      );
    }

    await batch.save();

    await this.activityLogService.create(authUser, {
      action: 'Update Giving Batch',
      module: ModuleSections.GIVING,
      details: `Updated giving batch for ${batch.date}`,
    });

    return this.findById(tenant, id);
  }

  async submit(authUser: Admin, tenant: TenantContext, id: string) {
    const batch = await this.givingBatchModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!batch) {
      throw new NotFoundException('Giving batch not found');
    }
    if (batch.status !== GivingBatchStatus.DRAFT) {
      throw new BadRequestException('Only draft batches can be submitted');
    }

    batch.status = GivingBatchStatus.SUBMITTED;
    await batch.save();

    await this.activityLogService.create(authUser, {
      action: 'Submit Giving Batch',
      module: ModuleSections.GIVING,
      details: `Submitted giving batch for ${batch.date}`,
    });

    return this.findById(tenant, id);
  }

  async confirm(authUser: Admin, tenant: TenantContext, id: string) {
    const batch = await this.givingBatchModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!batch) {
      throw new NotFoundException('Giving batch not found');
    }
    if (batch.status === GivingBatchStatus.CONFIRMED) {
      throw new BadRequestException('Batch is already confirmed');
    }

    batch.status = GivingBatchStatus.CONFIRMED;
    batch.confirmedBy = authUser._id as any;
    batch.confirmedAt = new Date();
    await batch.save();

    await this.activityLogService.create(authUser, {
      action: 'Confirm Giving Batch',
      module: ModuleSections.GIVING,
      details: `Confirmed giving batch for ${batch.date}: ${batch.totalAmount}`,
    });

    return this.findById(tenant, id);
  }

  async void(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: VoidGivingBatchDto,
  ) {
    const batch = await this.givingBatchModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!batch) {
      throw new NotFoundException('Giving batch not found');
    }
    if (batch.isVoided) {
      throw new BadRequestException('Batch is already voided');
    }

    batch.isVoided = true;
    batch.voidReason = dto.voidReason;
    await batch.save();

    await this.activityLogService.create(authUser, {
      action: 'Void Giving Batch',
      module: ModuleSections.GIVING,
      details: `Voided giving batch for ${batch.date}: ${dto.voidReason}`,
    });

    return this.findById(tenant, id);
  }

  async checkDuplicate(tenant: TenantContext, dto: CheckDuplicateDto) {
    const existing = await this.givingBatchModel.findOne({
      ...buildTenantFilter(tenant),
      churchServiceId: new Types.ObjectId(dto.churchServiceId),
      date: dto.date,
      isVoided: false,
    });

    return { exists: !!existing, batchId: existing?._id?.toString() };
  }

  async summary(tenant: TenantContext, dto: GivingSummaryFilterDto) {
    const batchFilter: any = { ...buildTenantFilter(tenant), isVoided: false };

    if (dto.startDate || dto.endDate) {
      batchFilter.date = {};
      if (dto.startDate) {
        batchFilter.date.$gte = dto.startDate;
      }
      if (dto.endDate) {
        batchFilter.date.$lte = dto.endDate;
      }
    }

    const batches = await this.givingBatchModel
      .find(batchFilter)
      .select('_id totalAmount')
      .lean();
    const batchIds = batches.map((batch) => batch._id);
    const totalAmount = batches.reduce(
      (sum, batch) => sum + (batch.totalAmount || 0),
      0,
    );

    if (batchIds.length === 0) {
      return {
        totalAmount: 0,
        batchCount: 0,
        byOfferingType: [],
        byCurrency: [],
      };
    }

    const [byOfferingType, byCurrency] = await Promise.all([
      this.givingEntryModel.aggregate([
        { $match: { batchId: { $in: batchIds } } },
        {
          $lookup: {
            from: 'offeringtypes',
            localField: 'offeringTypeId',
            foreignField: '_id',
            as: 'offeringType',
          },
        },
        {
          $group: {
            _id: '$offeringTypeId',
            name: { $first: { $arrayElemAt: ['$offeringType.name', 0] } },
            totalAmount: { $sum: '$amount' },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
      this.givingEntryModel.aggregate([
        { $match: { batchId: { $in: batchIds } } },
        {
          $group: {
            _id: '$currencyCode',
            totalAmount: { $sum: '$amount' },
          },
        },
        { $sort: { totalAmount: -1 } },
      ]),
    ]);

    return {
      totalAmount,
      batchCount: batches.length,
      byOfferingType: byOfferingType.map((row) => ({
        offeringTypeId: row._id?.toString(),
        name: row.name || 'Unknown',
        totalAmount: row.totalAmount || 0,
      })),
      byCurrency: byCurrency.map((row) => ({
        currencyCode: row._id,
        totalAmount: row.totalAmount || 0,
      })),
    };
  }

  // Monthly totals per currency for the current year - shape matches
  // GivingRecordService.monthlyTrend's spirit but broken out by currency
  // Since a batch can now mix currencies across entries.
  async monthlyTrend(tenant: TenantContext) {
    const targetYear = new Date().getFullYear();

    const batches = await this.givingBatchModel
      .find({ ...buildTenantFilter(tenant), isVoided: false })
      .select('_id date')
      .lean();

    const batchesInYear = batches.filter((batch) => {
      const date = new Date(batch.date);
      return !isNaN(date.getTime()) && date.getFullYear() === targetYear;
    });

    if (batchesInYear.length === 0) {
      return [];
    }

    const monthByBatchId = new Map<string, number>();
    batchesInYear.forEach((batch) => {
      monthByBatchId.set(batch._id.toString(), new Date(batch.date).getMonth());
    });

    const entries = await this.givingEntryModel
      .find({ batchId: { $in: batchesInYear.map((batch) => batch._id) } })
      .select('batchId currencyCode amount')
      .lean();

    const totals = new Map<string, number>();
    for (const entry of entries) {
      const month = monthByBatchId.get(entry.batchId.toString());
      if (month === undefined) {
        continue;
      }
      const key = `${month}|${entry.currencyCode}`;
      totals.set(key, (totals.get(key) || 0) + (entry.amount || 0));
    }

    return Array.from(totals.entries())
      .map(([key, totalAmount]) => {
        const [monthIndex, currencyCode] = key.split('|');
        return {
          month: MONTH_NAMES[Number(monthIndex)],
          currencyCode,
          totalAmount,
        };
      })
      .sort(
        (a, b) => MONTH_NAMES.indexOf(a.month) - MONTH_NAMES.indexOf(b.month),
      );
  }

  private toResponse(batch: any, entries?: any[]) {
    const service = batch.churchServiceId;
    const isPopulated = service && typeof service === 'object' && service.title;

    const response: any = {
      id: batch._id.toString(),
      churchServiceId: isPopulated
        ? service._id.toString()
        : service?.toString() || null,
      serviceTitle: isPopulated ? service.title : undefined,
      date: batch.date,
      status: batch.status,
      countedWith: batch.countedWith,
      notes: batch.notes,
      confirmedBy: batch.confirmedBy?.toString() || null,
      confirmedAt: batch.confirmedAt,
      isVoided: batch.isVoided,
      voidReason: batch.voidReason,
      editReason: batch.editReason,
      recordedBy: batch.recordedBy?.toString() || null,
      totalAmount: batch.totalAmount || 0,
      source: batch.source,
      createdAt: batch.createdAt,
      updatedAt: batch.updatedAt,
    };

    if (entries) {
      response.entries = entries.map((entry) => {
        const offeringType = entry.offeringTypeId;
        const offeringTypePopulated =
          offeringType && typeof offeringType === 'object' && offeringType.name;

        return {
          id: entry._id.toString(),
          offeringTypeId: offeringTypePopulated
            ? offeringType._id.toString()
            : offeringType?.toString(),
          offeringTypeName: offeringTypePopulated
            ? offeringType.name
            : undefined,
          currencyCode: entry.currencyCode,
          amount: entry.amount || 0,
          paymentMethod: entry.paymentMethod,
          note: entry.note,
          donorName: entry.donorName,
          donorEmail: entry.donorEmail,
          paymentReference: entry.paymentReference,
        };
      });
    }

    return response;
  }
}
