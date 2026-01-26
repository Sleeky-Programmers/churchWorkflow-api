import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';
import { Admin } from '../../schemas/admin.schema';
import { ChurchService } from '../church/church.service';
import { CreateAdminDto } from '././dto/create-admin.dto';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    private churchService: ChurchService,
  ) {}

  async createAdmin(
    adminRegisterDto: CreateAdminDto,
    churchId: Types.ObjectId,
    churchRole: Types.ObjectId,
    title: string | null,
  ) {
    const church = await this.churchService.findById(churchId);

    if (!church) {
      throw new NotFoundException('Church not found');
    }

    return await this.adminModel.create({
      ...adminRegisterDto,
      ...(title && { title }),
      churchId,
      churchRole,
      isVerified: true,
      password: bcrypt.hashSync(adminRegisterDto.password, 10),
    });
  }

  async create(createSuperAdminDto: CreateSuperAdminDto) {
    const church = await this.churchService.create({
      name: createSuperAdminDto.churchName,
    });
    return await this.adminModel.create({
      ...createSuperAdminDto,
      password: bcrypt.hashSync(createSuperAdminDto.password, 10),
      churchId: church._id,
    });
  }

  async findAll() {
    return await this.adminModel.find();
  }

  async findOne(email: string) {
    return await this.adminModel.findOne({ email }).select('+password');
  }

  async findById(id: Types.ObjectId) {
    return await this.adminModel.findById(id);
  }

  async findOneAndUpdate(email: string, updateData: Partial<Admin>) {
    return await this.adminModel.findOneAndUpdate({ email }, updateData, {
      new: true,
    });
  }

  async findByIdAndUpdate(id: Types.ObjectId, updateData: Partial<Admin>) {
    return await this.adminModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
  }
}
