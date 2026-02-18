import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response } from 'express';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';
import { ActivityLog } from '../../schemas/activity-log.schema';
import { Admin } from '../../schemas/admin.schema';
import { ActivityLogDto } from './dto/activity-log.dto';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectModel(ActivityLog.name) private activityLogModel: Model<ActivityLog>,
  ) {}

  async create(authUser: Admin, activityLogDto: ActivityLogDto) {
    return await this.activityLogModel.create({
      adminId: authUser._id,
      ...activityLogDto,
    });
  }

  async findAll(authUser: Admin) {
    return await this.activityLogModel
      .find({ churchId: authUser.churchId })
      .populate('adminId', 'name')
      .sort({ createdAt: -1 });
  }

  async findById(id: string) {
    return await this.activityLogModel.findById(id).populate('adminId', 'name');
  }

  async delete(id: string) {
    return await this.activityLogModel.findByIdAndDelete(id);
  }

  async exportToCSV(authUser: Admin) {
    const logs = await this.activityLogModel
      .find({ churchId: authUser.churchId })
      .populate('adminId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = logs.map((log: any) => ({
      Admin: log.adminId?.name || 'N/A',
      Action: log.action,
      Description: log.description,
      Date: log.createdAt,
    }));

    const parser = new Parser({
      fields: ['Admin', 'Action', 'Description', 'Date'],
    });

    return parser.parse(formatted);
  }

  async exportToPDF(authUser: Admin, res: Response) {
    const logs = await this.activityLogModel
      .find({ churchId: authUser.churchId })
      .populate('adminId', 'name')
      .sort({ createdAt: -1 });

    const doc = new PDFDocument({ margin: 30 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=activity-logs.pdf',
    );

    doc.pipe(res);

    doc.fontSize(18).text('Activity Logs Report', { align: 'center' });
    doc.moveDown();

    logs.forEach((log: any, index) => {
      doc
        .fontSize(12)
        .text(`${index + 1}. Admin: ${log.adminId?.name || 'N/A'}`);
      doc.text(`Action: ${log.action}`);
      doc.text(`Description: ${log.description}`);
      doc.text(`Date: ${log.createdAt}`);
      doc.moveDown();
    });

    doc.end();
  }
}
