import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Response } from 'express';
import { Parser } from 'json2csv';
import { ActivityLog } from '../../schemas/activity-log.schema';
import { Admin } from '../../schemas/admin.schema';
import { ActivityLogDto } from './dto/activity-log.dto';
import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
const PDFDocument = require('pdfkit');

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectModel(ActivityLog.name) private activityLogModel: Model<ActivityLog>,
  ) {}

  async create(authUser: Admin, activityLogDto: ActivityLogDto) {
    return await this.activityLogModel.create({
      adminId: authUser._id,
      churchId: authUser.churchId,
      ...activityLogDto,
    });
  }

  async findAll(authUser: Admin, paginationBaseDto: PaginationBaseDto) {
    const { page, limit } = paginationBaseDto;

    const skip = (page - 1) * limit;

    const filter = { churchId: authUser.churchId };

    const [logs, itemCount] = await Promise.all([
      this.activityLogModel
        .find(filter)
        .populate('adminId', 'firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      this.activityLogModel.countDocuments(filter),
    ]);

    return {
      data: logs,
      pagination: paginationMeta({
        page,
        limit,
        itemCount,
      }),
    };
  }

  async getActivitiesSuperAdmin(paginationBaseDto: PaginationBaseDto) {
    const { page = 1, limit = 10 } = paginationBaseDto;

    const skip = (page - 1) * limit;

    const [logs, itemCount] = await Promise.all([
      this.activityLogModel
        .find()
        .populate('adminId', 'firstName lastName')
        .populate('churchId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      this.activityLogModel.countDocuments(),
    ]);

    const formattedData = logs.map((log: any) => {
      const activity = {
        id: log._id,
        action: log.action,
        module: log.module,
        description: log.details,
        createdAt: log.createdAt,

        adminName: log.adminId
          ? `${log.adminId.firstName} ${log.adminId.lastName}`
          : 'System',

        churchName: log.churchId?.name || 'Unknown Church',
        churchId: log.churchId?._id || null,
      };

      return {
        ...activity,

        text: this.formatActivity(activity),
        time: this.formatTime(activity.createdAt),
        color: this.getActivityColor(activity.module),
      };
    });

    return {
      data: formattedData,
      pagination: paginationMeta({
        page,
        limit,
        itemCount,
      }),
    };
  }
  async getRecentActivitiesSuperAdmin(limit = 5) {
    const { data } = await this.getActivitiesSuperAdmin({
      page: 1,
      limit,
    });

    return data;
  }

  async findById(id: string) {
    return await this.activityLogModel
      .findById(id)
      .populate('adminId', 'firstName lastName');
  }

  async delete(id: string) {
    return await this.activityLogModel.findByIdAndDelete(id);
  }

  async deleteByAdminId(adminId: Types.ObjectId) {
    return await this.activityLogModel.deleteMany({ adminId });
  }

  async exportToCSV(authUser: Admin, res: Response) {
    const logs = await this.activityLogModel
      .find({ churchId: authUser.churchId })
      .populate('adminId', 'firstName lastName')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = logs.map((log: any) => ({
      Admin: log.adminId
        ? `${log.adminId.firstName} ${log.adminId.lastName}`
        : 'N/A',
      Action: log.action,
      Description: log.description,
      Date: log.createdAt,
    }));

    const parser = new Parser({
      fields: ['Admin', 'Action', 'Description', 'Date'],
    });

    const csv = parser.parse(formatted);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=activity-logs.csv',
    );

    res.status(200).send(csv);
  }

  async exportToPDF(authUser: Admin, res: Response) {
    const logs = await this.activityLogModel
      .find({ churchId: authUser.churchId })
      .populate('adminId', 'firstName lastName')
      .sort({ createdAt: -1 });

    const doc = new PDFDocument({ margin: 30 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=activity-logs.pdf',
    );

    doc.pipe(res);

    doc.fontSize(18).text('Activity Logs Report', {
      align: 'center',
    });

    doc.moveDown();

    logs.forEach((log: any, index) => {
      const adminName = log.adminId
        ? `${log.adminId.firstName} ${log.adminId.lastName}`
        : 'N/A';

      doc.fontSize(12).text(`${index + 1}. Admin: ${adminName}`);
      doc.text(`Action: ${log.action}`);
      doc.text(`Description: ${log.description}`);
      doc.text(`Date: ${log.createdAt}`);
      doc.moveDown();
    });

    doc.end();
  }
  private formatActivity(log: any): string {
    const churchName = log.churchName || 'System';
    return `${churchName} — ${log.description}`;
  }

  private formatTime(date: Date): string {
    const diff = Date.now() - new Date(date).getTime();

    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) {
      return 'Just now';
    }
    if (minutes < 60) {
      return `${minutes} mins ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours} hours ago`;
    }

    const days = Math.floor(hours / 24);
    if (days === 1) {
      return 'Yesterday';
    }

    return `${days} days ago`;
  }

  private getActivityColor(module: string): string {
    const map = {
      MEMBERS: 'bg-blue-500',
      SUBSCRIPTION: 'bg-green-500',
      PAYMENT: 'bg-amber-500',
      CHURCH: 'bg-purple-500',
    };

    return map[module] || 'bg-gray-400';
  }
}
