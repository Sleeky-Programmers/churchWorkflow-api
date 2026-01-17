import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { CreateAdminDto } from './dto/create-admin.dto';
import { Admin } from '../../schemas/admin.schema';
import { ChurchService } from '../church/church.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    private churchService: ChurchService,
  ) {}

  async create(createAdminDto: CreateAdminDto) {
    const church = await this.churchService.create({
      name: createAdminDto.churchName,
    });
    return await this.adminModel.create({
      ...createAdminDto,
      password: bcrypt.hashSync(createAdminDto.password, 10),
      churchId: church._id,
    });
  }

  async findAll() {
    return await this.adminModel.find();
  }

  async findOne(email: string) {
    return await this.adminModel.findOne({ email }).select('+password');
  }

  async findById(id: string) {
    return await this.adminModel.findById(id);
  }

  async findOneAndUpdate(email: string, updateData: Partial<Admin>) {
    return await this.adminModel.findOneAndUpdate({ email }, updateData, {
      new: true,
    });
  }

  async findByIdAndUpdate(id: string, updateData: Partial<Admin>) {
    return await this.adminModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
  }
}
