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
import { Expense } from '../../schemas/expense.schema';
import { Role } from '../../schemas/role.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ChurchService } from '../church/church.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseFilterDto } from './dto/expense-filter.dto';
import { ExpenseSummaryFilterDto } from './dto/expense-summary-filter.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

function endOfDay(dateStr: string) {
  const date = new Date(dateStr);
  date.setHours(23, 59, 59, 999);
  return date;
}

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
export class ExpenseService {
  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<Expense>,
    private churchService: ChurchService,
    private activityLogService: ActivityLogService,
  ) {}

  private hasFullExpenseAccess(authUser: Admin): boolean {
    const role = authUser.churchRole as unknown as Role;
    if (!role) {
      return false;
    }
    if (role.type === RoleType.SYSTEM && role.roleName === 'Super Admin') {
      return true;
    }
    const perm = role.permissions?.find(
      (p) => p.moduleSection === ModuleSections.GIVING_AND_EXPENSES,
    );
    return perm?.accessLevel === AccessLevel.FULL_ACCESS;
  }

  async create(authUser: Admin, tenant: TenantContext, dto: CreateExpenseDto) {
    const church = await this.churchService.findById(tenant.churchId);
    const currency = church?.defaultCurrency || 'NGN';

    const created = await this.expenseModel.create({
      churchId: tenant.churchId,
      branchId: tenant.branchId,
      category: dto.category.trim(),
      description: dto.description.trim(),
      amount: dto.amount,
      currency,
      date: new Date(dto.date),
      departmentId: dto.departmentId
        ? new Types.ObjectId(dto.departmentId)
        : null,
      recordedBy: authUser._id,
    });

    await this.activityLogService.create(authUser, {
      action: 'Record Expense',
      module: ModuleSections.GIVING_AND_EXPENSES,
      details: `Recorded expense: ${created.category} - ${currency} ${created.amount}`,
    });

    return this.toResponse(created);
  }

  async findAll(tenant: TenantContext, dto: ExpenseFilterDto) {
    const {
      page = 1,
      limit = 20,
      startDate,
      endDate,
      category,
      departmentId,
    } = dto;
    const skip = (page - 1) * limit;

    const filter: any = { ...buildTenantFilter(tenant) };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) {
        filter.date.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.date.$lte = endOfDay(endDate);
      }
    }
    if (category) {
      filter.category = { $regex: category, $options: 'i' };
    }
    if (departmentId) {
      filter.departmentId = new Types.ObjectId(departmentId);
    }

    const [expenses, itemCount] = await Promise.all([
      this.expenseModel
        .find(filter)
        .populate('departmentId', 'name')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.expenseModel.countDocuments(filter),
    ]);

    return {
      data: expenses.map((expense) => this.toResponse(expense)),
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async findById(tenant: TenantContext, id: string) {
    const expense = await this.expenseModel
      .findOne({ _id: id, ...buildTenantFilter(tenant) })
      .populate('departmentId', 'name')
      .lean();

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return this.toResponse(expense);
  }

  async summary(tenant: TenantContext, dto: ExpenseSummaryFilterDto) {
    const filter: any = { ...buildTenantFilter(tenant) };

    if (dto.startDate || dto.endDate) {
      filter.date = {};
      if (dto.startDate) {
        filter.date.$gte = new Date(dto.startDate);
      }
      if (dto.endDate) {
        filter.date.$lte = endOfDay(dto.endDate);
      }
    }

    const expenses = await this.expenseModel.find(filter).lean();

    const totalAmount = expenses.reduce(
      (sum, expense) => sum + (expense.amount || 0),
      0,
    );

    const byCategory = expenses.reduce<Record<string, number>>(
      (acc, expense) => {
        const key = expense.category || 'Uncategorized';
        acc[key] = (acc[key] || 0) + (expense.amount || 0);
        return acc;
      },
      {},
    );

    return {
      totalAmount,
      recordCount: expenses.length,
      byCategory: Object.entries(byCategory).map(([category, amount]) => ({
        category,
        amount,
      })),
    };
  }

  // Monthly totals for the current year - shape matches
  // GivingRecordService.monthlyTrend so both feed the same dashboard chart.
  async monthlyTrend(tenant: TenantContext) {
    const targetYear = new Date().getFullYear();

    const expenses = await this.expenseModel
      .find({ ...buildTenantFilter(tenant) })
      .select('date amount')
      .lean();

    const totalsByMonth = new Array(12).fill(0);

    for (const expense of expenses) {
      const date = new Date(expense.date);
      if (isNaN(date.getTime()) || date.getFullYear() !== targetYear) {
        continue;
      }
      totalsByMonth[date.getMonth()] += expense.amount || 0;
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
    dto: UpdateExpenseDto,
  ) {
    const existing = await this.expenseModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!existing) {
      throw new NotFoundException('Expense not found');
    }

    const updatePayload: Partial<Expense> = {};
    if (typeof dto.category === 'string') {
      updatePayload.category = dto.category.trim();
    }
    if (typeof dto.description === 'string') {
      updatePayload.description = dto.description.trim();
    }
    if (typeof dto.amount === 'number') {
      updatePayload.amount = dto.amount;
    }
    if (typeof dto.date === 'string') {
      updatePayload.date = new Date(dto.date);
    }
    if (dto.departmentId !== undefined) {
      updatePayload.departmentId = dto.departmentId
        ? (new Types.ObjectId(dto.departmentId) as any)
        : null;
    }

    await this.expenseModel.updateOne({ _id: id }, updatePayload);

    await this.activityLogService.create(authUser, {
      action: 'Update Expense',
      module: ModuleSections.GIVING_AND_EXPENSES,
      details: `Updated expense: ${existing.category}`,
    });

    return this.findById(tenant, id);
  }

  async delete(authUser: Admin, tenant: TenantContext, id: string) {
    if (!this.hasFullExpenseAccess(authUser)) {
      throw new ForbiddenException(
        'You do not have permission to delete expenses',
      );
    }

    const deleted = await this.expenseModel.findOneAndDelete({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!deleted) {
      throw new NotFoundException('Expense not found');
    }

    await this.activityLogService.create(authUser, {
      action: 'Delete Expense',
      module: ModuleSections.GIVING_AND_EXPENSES,
      details: `Deleted expense: ${deleted.category} - ${deleted.currency} ${deleted.amount}`,
    });

    return { message: 'Expense deleted successfully' };
  }

  private toResponse(expense: any) {
    const department = expense.departmentId;
    const isPopulated =
      department && typeof department === 'object' && department.name;

    return {
      id: expense._id.toString(),
      category: expense.category,
      description: expense.description,
      amount: expense.amount || 0,
      currency: expense.currency,
      date: expense.date,
      departmentId: isPopulated
        ? department._id.toString()
        : department?.toString() || null,
      departmentName: isPopulated ? department.name : undefined,
      requisitionId: expense.requisitionId?.toString() || null,
      recordedBy: expense.recordedBy?.toString(),
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };
  }
}
