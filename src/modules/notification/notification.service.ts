import { Model, Types } from 'mongoose';

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import { Notification } from '../../schemas/notification.schema';
import { NotificationDto } from './dto/notification.dto';

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
      recipientId: notificationDto.recipientId
        ? new Types.ObjectId(notificationDto.recipientId.toString())
        : null,
    });
  }

  // Church-wide notifications plus the ones addressed to this admin.
  private visibleTo(churchId: Types.ObjectId, adminId?: Types.ObjectId) {
    return {
      churchId,
      $or: [
        { recipientId: null },
        ...(adminId ? [{ recipientId: adminId }] : []),
      ],
    };
  }

  async getNotifications(
    churchId: Types.ObjectId,
    paginationBaseDto: PaginationBaseDto,
    adminId?: Types.ObjectId,
  ) {
    const { page, limit } = paginationBaseDto;

    const skip = (page - 1) * limit;
    const filter = this.visibleTo(churchId, adminId);

    const [notifications, itemCount] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      this.notificationModel.countDocuments(filter),
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

  async markAllAsRead(churchId: Types.ObjectId, adminId?: Types.ObjectId) {
    return await this.notificationModel.updateMany(
      { ...this.visibleTo(churchId, adminId), isRead: false },
      { isRead: true },
    );
  }

  async getAllNotifications(paginationBaseDto: PaginationBaseDto) {
    const { page, limit } = paginationBaseDto;

    const skip = (page - 1) * limit;

    const [notifications, itemCount] = await Promise.all([
      this.notificationModel
        .find()
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      this.notificationModel.countDocuments(),
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

  async markAllAsReadSystem(notificationId: string) {
    return await this.notificationModel.findByIdAndUpdate(
      notificationId,
      { isRead: true },
      { new: true },
    );
  }

  async markAsReadAdmin() {
    return await this.notificationModel.updateMany(
      { isRead: false },
      { isRead: true },
    );
  }
}
