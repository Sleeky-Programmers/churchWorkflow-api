import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { CreateSuperAdminDto } from './dto/create-super-admin.dto';
import { Admin } from '../../schemas/admin.schema';
import { ChurchService } from '../church/church.service';
import { CreateAdminDto } from '././dto/create-admin.dto';
import { RolesService } from '../roles/roles.service';
import { AccountSettingsService } from '../account-settings/account-settings.service';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    private churchService: ChurchService,
    private rolesService: RolesService,
    private accountSettingsService: AccountSettingsService,
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

    const admin = await this.adminModel.create({
      ...adminRegisterDto,
      ...(title && { title }),
      churchId,
      churchRole,
      isVerified: true,
      password: bcrypt.hashSync(adminRegisterDto.password, 10),
    });

    await this.accountSettingsService.createDefaultAccountSettings(admin._id);

    return admin;
  }

  async createSuperAdmin(createSuperAdminDto: CreateSuperAdminDto) {
    const roleName = 'Super Admin';
    const superAdminRole = await this.rolesService.ensureSystemRole(roleName);

    if (!superAdminRole) {
      throw new NotFoundException('Super Admin role not found');
    }

    const superAdmin = await this.adminModel.create({
      ...createSuperAdminDto,
      churchRole: superAdminRole._id,
      password: bcrypt.hashSync(createSuperAdminDto.password, 10),
    });

    await this.accountSettingsService.createDefaultAccountSettings(
      superAdmin._id,
    );

    return superAdmin;
  }

  async findAll() {
    return await this.adminModel.find();
  }

  async findOne(email: string) {
    return await this.adminModel.findOne({ email }).select('+password');
  }

  async findById(id: Types.ObjectId) {
    return await this.adminModel.findById(id).populate('churchRole');
  }

  async findByIdForRefreshToken(id: Types.ObjectId) {
    return await this.adminModel.findById(id).select('+refreshToken');
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

  async findOneAndDelete(email: string) {
    return await this.adminModel.findOneAndDelete({ email });
  }

  async findByIdAndDelete(id: Types.ObjectId) {
    return await this.adminModel.findByIdAndDelete(id);
  }
}
