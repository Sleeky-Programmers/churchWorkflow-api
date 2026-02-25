import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { NotificationDto } from './dto/notification.dto';
import { Notification } from '../../schemas/notification.schema';
import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';

@Injectable()
export class NotificationService {
  constructor(
    @InjectModel(Notification.name)
    private notificationModel: Model<Notification>,
  ) {}

  async createNotification(
    churchId: Types.ObjectId,
    notificationDto: NotificationDto,
  ) {
    return await this.notificationModel.create({
      churchId,
      title: notificationDto.title,
      body: notificationDto.body,
      type: notificationDto.type,
    });
  }

  async getNotifications(
    churchId: Types.ObjectId,
    paginationBaseDto: PaginationBaseDto,
  ) {
    const { page, limit } = paginationBaseDto;

    const skip = (page - 1) * limit;

    const [notifications, itemCount] = await Promise.all([
      this.notificationModel
        .find({ churchId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      this.notificationModel.countDocuments({ churchId }),
    ]);

    return {
      data: notifications,
      pagination: paginationMeta({
        page,
        limit,
        itemCount,
      }),
    };
  }

  async markAsRead(notificationId: string) {
    return await this.notificationModel.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true },
    );
  }

  async markAllAsRead(churchId: Types.ObjectId) {
    return await this.notificationModel.updateMany(
      { churchId, isRead: false },
      { isRead: true },
    );
  }
}
