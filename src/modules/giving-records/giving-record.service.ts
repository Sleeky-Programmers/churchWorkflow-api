import { Model, Types } from 'mongoose';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { paginationMeta } from '../../common/helpers/pagination.helper';
import {
  AccessLevel,
  ModuleSections,
  RoleType,
} from '../../common/utils/enums.utils';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { buildTenantFilter } from '../../common/utils/tenant-filter.util';
import { Admin } from '../../schemas/admin.schema';
import { GivingRecord } from '../../schemas/giving-record.schema';
import { Role } from '../../schemas/role.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ChurchService } from '../church/church.service';
import { CreateGivingRecordDto } from './dto/create-giving-record.dto';
import { GivingRecordFilterDto } from './dto/giving-record-filter.dto';
import { GivingSummaryFilterDto } from './dto/giving-summary-filter.dto';
import { UpdateGivingRecordDto } from './dto/update-giving-record.dto';

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
export class GivingRecordService {
  constructor(
    @InjectModel(GivingRecord.name)
    private givingRecordModel: Model<GivingRecord>,
    private churchService: ChurchService,
    private activityLogService: ActivityLogService,
  ) {}

  // GIVING_AND_EXPENSES is the superset section - it unlocks giving access
  // Too, so the effective level is whichever section grants more.
  private effectiveGivingLevel(authUser: Admin): AccessLevel {
    const role = authUser.churchRole as unknown as Role;
    if (!role) {
      return AccessLevel.NO_ACCESS;
    }
    if (role.type === RoleType.SYSTEM && role.roleName === 'Super Admin') {
      return AccessLevel.FULL_ACCESS;
    }

    const rank: Record<AccessLevel, number> = {
      [AccessLevel.NO_ACCESS]: 0,
      [AccessLevel.VIEW]: 1,
      [AccessLevel.MANAGE]: 2,
      [AccessLevel.FULL_ACCESS]: 3,
    };

    const givingLevel =
      role.permissions?.find((p) => p.moduleSection === ModuleSections.GIVING)
        ?.accessLevel || AccessLevel.NO_ACCESS;
    const givingAndExpensesLevel =
      role.permissions?.find(
        (p) => p.moduleSection === ModuleSections.GIVING_AND_EXPENSES,
      )?.accessLevel || AccessLevel.NO_ACCESS;

    return rank[givingLevel] >= rank[givingAndExpensesLevel]
      ? givingLevel
      : givingAndExpensesLevel;
  }

  private hasFullGivingAccess(authUser: Admin): boolean {
    return this.effectiveGivingLevel(authUser) === AccessLevel.FULL_ACCESS;
  }

  // Create-or-update, keyed by (churchServiceId, date) - matches how
  // GivingRecordModal presents itself as "the" giving record for a single
  // Service occurrence, so saving it twice updates rather than duplicates.
  async upsert(
    authUser: Admin,
    tenant: TenantContext,
    dto: CreateGivingRecordDto,
  ) {
    const church = await this.churchService.findById(tenant.churchId);
    const currency = church?.defaultCurrency || 'NGN';

    const tithe = dto.tithe || 0;
    const offering = dto.offering || 0;
    const specialOffering = dto.specialOffering || 0;
    const thanksgivingOffering = dto.thanksgivingOffering || 0;
    const totalAmount =
      tithe + offering + specialOffering + thanksgivingOffering;

    const filter = {
      ...buildTenantFilter(tenant),
      churchServiceId: new Types.ObjectId(dto.churchServiceId),
      date: dto.date,
    };

    const existing = await this.givingRecordModel.findOne(filter);

    const record = await this.givingRecordModel.findOneAndUpdate(
      filter,
      {
        ...filter,
        tithe,
        offering,
        specialOffering,
        thanksgivingOffering,
        totalAmount,
        currency,
        recordedBy: authUser._id,
      },
      { new: true, upsert: true },
    );

    await this.activityLogService.create(authUser, {
      action: existing ? 'Update Giving Record' : 'Record Giving',
      module: ModuleSections.GIVING,
      details: `${existing ? 'Updated' : 'Recorded'} giving for ${dto.date}: ${currency} ${totalAmount}`,
    });

    return this.toResponse(record);
  }

  async findAll(
    authUser: Admin,
    tenant: TenantContext,
    dto: GivingRecordFilterDto,
  ) {
    const { page = 1, limit = 20, startDate, endDate, churchServiceId } = dto;
    const skip = (page - 1) * limit;

    const filter: any = { ...buildTenantFilter(tenant) };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = startDate;
      }
      if (endDate) {
        filter.date.$lte = endDate;
      }
    }
    if (churchServiceId) {
      filter.churchServiceId = new Types.ObjectId(churchServiceId);
    }

    const [records, itemCount] = await Promise.all([
      this.givingRecordModel
        .find(filter)
        .populate('churchServiceId', 'title startTime endTime location')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.givingRecordModel.countDocuments(filter),
    ]);

    return {
      data: records.map((record) => this.toResponse(record)),
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async findById(tenant: TenantContext, id: string) {
    const record = await this.givingRecordModel
      .findOne({ _id: id, ...buildTenantFilter(tenant) })
      .populate('churchServiceId', 'title startTime endTime location')
      .lean();

    if (!record) {
      throw new NotFoundException('Giving record not found');
    }

    return this.toResponse(record);
  }

  async summary(tenant: TenantContext, dto: GivingSummaryFilterDto) {
    const filter: any = { ...buildTenantFilter(tenant) };

    if (dto.startDate || dto.endDate) {
      filter.date = {};
      if (dto.startDate) {
        filter.date.$gte = dto.startDate;
      }
      if (dto.endDate) {
        filter.date.$lte = dto.endDate;
      }
    }

    const records = await this.givingRecordModel.find(filter).lean();

    const totals = records.reduce(
      (acc, record) => {
        acc.tithe += record.tithe || 0;
        acc.offering += record.offering || 0;
        acc.specialOffering += record.specialOffering || 0;
        acc.thanksgivingOffering += record.thanksgivingOffering || 0;
        acc.totalAmount += record.totalAmount || 0;
        return acc;
      },
      {
        tithe: 0,
        offering: 0,
        specialOffering: 0,
        thanksgivingOffering: 0,
        totalAmount: 0,
      },
    );

    return { ...totals, recordCount: records.length };
  }

  // Monthly totals for the current year - shape matches
  // AttendanceService.getAttendanceTrend so it slots into the same
  // Dashboard trend chart.
  async monthlyTrend(tenant: TenantContext) {
    const targetYear = new Date().getFullYear();

    const records = await this.givingRecordModel
      .find({ ...buildTenantFilter(tenant) })
      .select('date totalAmount')
      .lean();

    const totalsByMonth = new Array(12).fill(0);

    for (const record of records) {
      const date = new Date(record.date);
      if (isNaN(date.getTime()) || date.getFullYear() !== targetYear) {
        continue;
      }
      totalsByMonth[date.getMonth()] += record.totalAmount || 0;
    }

    return totalsByMonth.map((totalAmount, index) => ({
      month: MONTH_NAMES[index],
      totalAmount,
    }));
  }

  async update(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: UpdateGivingRecordDto,
  ) {
    const existing = await this.givingRecordModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!existing) {
      throw new NotFoundException('Giving record not found');
    }

    const tithe = dto.tithe ?? existing.tithe;
    const offering = dto.offering ?? existing.offering;
    const specialOffering = dto.specialOffering ?? existing.specialOffering;
    const thanksgivingOffering =
      dto.thanksgivingOffering ?? existing.thanksgivingOffering;

    await this.givingRecordModel.updateOne(
      { _id: id },
      {
        tithe,
        offering,
        specialOffering,
        thanksgivingOffering,
        totalAmount: tithe + offering + specialOffering + thanksgivingOffering,
        recordedBy: authUser._id,
      },
    );

    await this.activityLogService.create(authUser, {
      action: 'Update Giving Record',
      module: ModuleSections.GIVING,
      details: `Updated giving record for ${existing.date}`,
    });

    return this.findById(tenant, id);
  }

  async delete(authUser: Admin, tenant: TenantContext, id: string) {
    if (!this.hasFullGivingAccess(authUser)) {
      throw new ForbiddenException(
        'You do not have permission to delete giving records',
      );
    }

    const deleted = await this.givingRecordModel.findOneAndDelete({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!deleted) {
      throw new NotFoundException('Giving record not found');
    }

    await this.activityLogService.create(authUser, {
      action: 'Delete Giving Record',
      module: ModuleSections.GIVING,
      details: `Deleted giving record for ${deleted.date}`,
    });

    return { message: 'Giving record deleted successfully' };
  }

  private toResponse(record: any) {
    const service = record.churchServiceId;
    const isPopulated = service && typeof service === 'object' && service.title;

    return {
      id: record._id.toString(),
      churchServiceId: isPopulated
        ? service._id.toString()
        : service?.toString(),
      serviceTitle: isPopulated ? service.title : undefined,
      date: record.date,
      tithe: record.tithe || 0,
      offering: record.offering || 0,
      specialOffering: record.specialOffering || 0,
      thanksgivingOffering: record.thanksgivingOffering || 0,
      totalAmount: record.totalAmount || 0,
      currency: record.currency,
      recordedBy: record.recordedBy?.toString(),
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
