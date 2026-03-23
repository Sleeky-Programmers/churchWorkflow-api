import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ChurchService } from '../../schemas/church-service.schema';
import { Admin } from '../../schemas/admin.schema';
import { CreateChurchServiceDto } from './dto/create-church-service.dto';
import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import { UpdateChurchServiceDto } from './dto/update-church-service.dto';

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

  async getServiceIdsByChurchId(churchId: any) {
    const services = await this.churchServiceModel
      .find({ churchId })
      .select('_id')
      .lean();
    return services.map((s) => s._id);
  }
}
