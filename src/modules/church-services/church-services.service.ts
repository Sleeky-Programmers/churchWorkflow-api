import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChurchService } from '../../schemas/church-service.schema';
import { Admin } from '../../schemas/admin.schema';
import { CreateChurchServiceDto } from './dto/create-church-service.dto';
import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import { UpdateChurchServiceDto } from './dto/update-church-service.dto';
import { ServiceDay, ServiceType } from '../../common/utils/enums.utils';

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class ChurchServicesService {
  constructor(
    @InjectModel(ChurchService.name)
    private churchServiceModel: Model<ChurchService>,
  ) {}

  async create(
    authUser: Admin,
    createChurchServiceDto: CreateChurchServiceDto,
  ) {
    const normalizedName = createChurchServiceDto.serviceName.trim();
    const normalizedLocation = (createChurchServiceDto.location || '').trim();
    const normalizedStartTime = createChurchServiceDto.startTime
      ?.trim()
      .toUpperCase();

    if (normalizedStartTime) {
      const duplicateFilter: any = {
        churchId: authUser.churchId,
        serviceName: {
          $regex: `^${escapeRegExp(normalizedName)}$`,
          $options: 'i',
        },
        startTime: normalizedStartTime,
      };
      duplicateFilter.location = normalizedLocation
        ? {
            $regex: `^${escapeRegExp(normalizedLocation)}$`,
            $options: 'i',
          }
        : { $in: [null, ''] };

      if (createChurchServiceDto.type) {
        duplicateFilter.type = createChurchServiceDto.type;
      }

      if (createChurchServiceDto.day) {
        duplicateFilter.day = createChurchServiceDto.day;
      }

      if (createChurchServiceDto.startDate) {
        duplicateFilter.startDate = new Date(createChurchServiceDto.startDate);
      }

      const existing = await this.churchServiceModel.findOne(duplicateFilter);
      if (existing) {
        throw new BadRequestException(
          'Event with same name and time already exists',
        );
      }
    }

    return await this.churchServiceModel.create({
      ...createChurchServiceDto,
      serviceName: normalizedName,
      startTime: normalizedStartTime,
      location: normalizedLocation || undefined,
      churchId: authUser.churchId,
    });
  }

  async findAll(authUser: Admin, paginationBaseDto: PaginationBaseDto) {
    const { page, limit } = paginationBaseDto;

    const skip = (page - 1) * limit;

    const filter = { churchId: authUser.churchId };

    const [services, itemCount] = await Promise.all([
      this.churchServiceModel.find(filter).skip(skip).limit(limit),
      this.churchServiceModel.countDocuments(filter),
    ]);

    return {
      data: services,
      pagination: paginationMeta({
        page,
        limit,
        itemCount,
      }),
    };
  }

  async findById(id: string) {
    return await this.churchServiceModel.findById(id);
  }

  async findOneInChurch(serviceId: string, churchId: Types.ObjectId) {
    return await this.churchServiceModel
      .findOne({
        _id: serviceId,
        churchId,
      })
      .lean();
  }

  async findByChurchId(churchId: Types.ObjectId) {
    return await this.churchServiceModel
      .find({ churchId })
      .select('_id serviceName')
      .lean();
  }

  async getServiceIdsByChurchId(churchId: Types.ObjectId) {
    const services = await this.churchServiceModel
      .find({ churchId })
      .select('_id')
      .lean();
    return services.map((service) => service._id);
  }

  async update(id: string, updateChurchServiceDto: UpdateChurchServiceDto) {
    return await this.churchServiceModel.findByIdAndUpdate(
      id,
      updateChurchServiceDto,
      {
        new: true,
      },
    );
  }

  async delete(id: string) {
    return await this.churchServiceModel.findByIdAndDelete(id);
  }

  async getServiceIdsByType(type: string) {
    const services = await this.churchServiceModel
      .find({ type })
      .select('_id')
      .lean();
    return services.map((s) => s._id);
  }

  async getServicesByDate(date: Date, churchId: Types.ObjectId) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const weekdayMap = {
      0: ServiceDay.SUNDAY,
      1: ServiceDay.MONDAY,
      2: ServiceDay.TUESDAY,
      3: ServiceDay.WEDNESDAY,
      4: ServiceDay.THURSDAY,
      5: ServiceDay.FRIDAY,
      6: ServiceDay.SATURDAY,
    } as const;

    const weekday = weekdayMap[new Date(date).getDay()];

    const regularFilter: any = {
      churchId,
      type: ServiceType.REGULAR,
      day: weekday,
      $and: [
        {
          $or: [
            { startDate: { $exists: false } },
            { startDate: { $lte: endOfDay } },
          ],
        },
        {
          $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: startOfDay } },
          ],
        },
      ],
    };

    const specialFilter: any = {
      churchId,
      $or: [
        {
          type: ServiceType.SPECIAL,
          startDate: { $gte: startOfDay, $lte: endOfDay },
        },
        { 'specialDays.date': { $gte: startOfDay, $lte: endOfDay } },
      ],
    };

    return await this.churchServiceModel
      .find({ $or: [regularFilter, specialFilter] })
      .lean();
  }
}
