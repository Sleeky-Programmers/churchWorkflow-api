import { Injectable } from '@nestjs/common';
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
    return await this.churchServiceModel.create({
      ...createChurchServiceDto,
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
}
