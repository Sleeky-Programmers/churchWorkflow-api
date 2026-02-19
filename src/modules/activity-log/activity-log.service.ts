import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
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

    const [logs, total] = await Promise.all([
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
        itemCount: total,
      }),
    };
  }

  async findById(id: string) {
    return await this.activityLogModel
      .findById(id)
      .populate('adminId', 'firstName lastName');
  }

  async delete(id: string) {
    return await this.activityLogModel.findByIdAndDelete(id);
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
}
