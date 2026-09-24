import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  paginationMeta,
  PaginationBaseDto,
} from '../../common/helpers/pagination.helper';
import { AdminActivityLog } from '../../schemas/admin-activity-log.schema';

const ADMIN_POPULATE = { path: 'adminId', select: 'name email' };

@Injectable()
export class AdminActivityLogService {
  constructor(
    @InjectModel(AdminActivityLog.name)
    private adminActivityLogModel: Model<AdminActivityLog>,
  ) {}

  async create(data: Partial<AdminActivityLog>) {
    return await this.adminActivityLogModel.create(data);
  }

  async findById(id: string) {
    return await this.adminActivityLogModel
      .findById(id)
      .populate(ADMIN_POPULATE);
  }

  async list(filter?: any & PaginationBaseDto) {
    const page = Number(filter?.page) || 1;
    const limit = Number(filter?.limit) || 20;
    const skip = (page - 1) * limit;

    const match: any = {};
    if (filter?.adminId) {
      match.adminId = new Types.ObjectId(filter.adminId);
    }
    if (filter?.action) {
      match.action = filter.action;
    }
    if (filter?.plan) {
      match.plan = filter.plan;
    }

    const [data, itemCount] = await Promise.all([
      this.adminActivityLogModel
        .find(match)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate(ADMIN_POPULATE),
      this.adminActivityLogModel.countDocuments(match),
    ]);

    return {
      data,
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async stats() {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [totalActivities, activitiesToday, activitiesThisWeek, admins] =
      await Promise.all([
        this.adminActivityLogModel.countDocuments({}),
        this.adminActivityLogModel.countDocuments({
          createdAt: { $gte: startOfToday },
        }),
        this.adminActivityLogModel.countDocuments({
          createdAt: { $gte: startOfWeek },
        }),
        this.adminActivityLogModel.distinct('adminId', {
          createdAt: { $gte: startOfWeek },
        }),
      ]);

    return {
      totalActivities,
      activitiesToday,
      activitiesThisWeek,
      activeAdminsThisWeek: admins.length,
    };
  }

  async update(id: string, data: Partial<AdminActivityLog>) {
    return await this.adminActivityLogModel.findByIdAndUpdate(id, data, {
      new: true,
    });
  }

  async remove(id: string) {
    return await this.adminActivityLogModel.findByIdAndDelete(id);
  }
}
