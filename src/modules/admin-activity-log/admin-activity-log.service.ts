import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  paginationMeta,
  PaginationBaseDto,
} from '../../common/helpers/pagination.helper';
import { AdminActivityLog } from '../../schemas/admin-activity-log.schema';

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
    return await this.adminActivityLogModel.findById(id);
  }

  async list(filter?: any & PaginationBaseDto) {
    const page = filter?.page || 1;
    const limit = filter?.limit || 20;
    const skip = (page - 1) * limit;

    const match: any = {};
    if (filter?.churchId) {
      match.churchId = new Types.ObjectId(filter.churchId);
    }
    if (filter?.adminId) {
      match.adminId = new Types.ObjectId(filter.adminId);
    }
    if (filter?.module) {
      match.module = filter.module;
    }
    if (filter?.action) {
      match.action = filter.action;
    }
    if (filter?.plan) {
      match.plan = filter.plan;
    }

    const pipeline: any[] = [
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const data = await this.adminActivityLogModel.aggregate(pipeline as any);
    const itemCount = await this.adminActivityLogModel.countDocuments(match);

    return {
      data,
      pagination: paginationMeta({ page, limit, itemCount }),
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
