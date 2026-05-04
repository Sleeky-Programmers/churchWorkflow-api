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
import { emailMatcher } from '../../common/helpers/email-matcher.helper';
import { AdminFilterDto } from '../../common/helpers/pagination.helper';

import {
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import { ChurchAdminStatus } from '../../common/utils/enums.utils';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    private churchService: ChurchService,
    private rolesService: RolesService,
    private accountSettingsService: AccountSettingsService,
  ) {}

  async countAdminsByChurch(churchId: Types.ObjectId) {
    return await this.adminModel.countDocuments({ churchId });
  }

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
      email: adminRegisterDto.email.toLowerCase().trim(),
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
      email: createSuperAdminDto.email.toLowerCase().trim(),
      churchRole: superAdminRole._id,
      password: bcrypt.hashSync(createSuperAdminDto.password, 10),
    });

    await this.accountSettingsService.createDefaultAccountSettings(
      superAdmin._id,
    );

    return superAdmin;
  }

  async findAll(id: Types.ObjectId) {
    return await this.adminModel.find({ churchId: id });
  }

  async findAllAdminWithPagination(
    churchId: Types.ObjectId,
    dto: AdminFilterDto,
  ) {
    const { page = 1, limit = 20, search, role, status } = dto;

    const skip = (page - 1) * limit;

    const query: any = {};

    if (churchId && Types.ObjectId.isValid(churchId)) {
      query.churchId = new Types.ObjectId(churchId);
    }

    if (status) {
      query.status = status;
    }

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const [admins, itemCount] = await Promise.all([
      this.adminModel
        .find(query)
        .sort({ createdAt: -1 })
        .populate({ path: 'churchId', select: 'name alias' })
        .populate({ path: 'churchRole', select: 'roleName' })
        .skip(skip)
        .limit(limit)
        .lean(),

      this.adminModel.countDocuments(query),
    ]);

    return {
      data: admins.map((a) => this.mapAdmin(a)).filter(Boolean),
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }
  async findOne(email: string) {
    return await this.adminModel
      .findOne({ email: emailMatcher(email) })
      .select('+password');
  }

  async findById(id: Types.ObjectId) {
    return await this.adminModel.findById(id).populate('churchRole');
  }

  async findNamesByIds(ids: string[]) {
    return await this.adminModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('firstName lastName')
      .lean();
  }

  async findOneAndUpdate(email: string, updateData: Partial<Admin>) {
    return await this.adminModel.findOneAndUpdate(
      { email: emailMatcher(email) },
      updateData,
      {
        new: true,
      },
    );
  }

  async blockAdmin(id: string) {
    const admin = await this.adminModel.findByIdAndUpdate(
      id,
      { status: ChurchAdminStatus.BLOCKED },
      { new: true },
    );

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  async unblockAdmin(id: string) {
    const admin = await this.adminModel.findByIdAndUpdate(
      id,
      { status: ChurchAdminStatus.ACTIVE },
      { new: true },
    );

    if (!admin) {
      throw new NotFoundException('Admin not found');
    }

    return admin;
  }

  async stats(churchId: Types.ObjectId) {
    const total = await this.adminModel.countDocuments({ churchId });

    const active = await this.adminModel.countDocuments({
      churchId,
      status: ChurchAdminStatus.ACTIVE,
    });

    const blocked = await this.adminModel.countDocuments({
      churchId,
      status: ChurchAdminStatus.BLOCKED,
    });

    const superRole = await this.rolesService.findOne('Super Admin');

    const superAdmins = superRole
      ? await this.adminModel.countDocuments({
          churchId,
          churchRole: superRole._id,
        })
      : 0;

    return {
      total,
      active,
      blocked,

      superAdmins,
    };
  }

  async findByIdAndUpdate(id: Types.ObjectId, updateData: Partial<Admin>) {
    return await this.adminModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
  }

  async findOneAndDelete(email: string) {
    return await this.adminModel.findOneAndDelete({
      email: emailMatcher(email),
    });
  }

  async findByIdAndDelete(id: Types.ObjectId) {
    return await this.adminModel.findByIdAndDelete(id);
  }
  mapAdmin(admin: any) {
    if (!admin) {
      return null;
    }

    return {
      id: admin?._id?.toString?.() ?? admin?.id ?? '',

      name:
        `${admin?.firstName ?? ''} ${admin?.lastName ?? ''}`.trim() ||
        'Unknown User',

      email: admin?.email ?? '',
      phone: admin?.phoneNumber ?? '—',

      role: admin?.churchRole?.roleName ?? 'Admin',
      status: admin?.status ?? ChurchAdminStatus.ACTIVE,

      lastActive:
        admin?.lastActive ?? admin?.createdAt ?? new Date().toISOString(),

      church: admin?.churchId
        ? {
            id: admin.churchId?._id?.toString?.() ?? admin.churchId?.id,
            name: admin.churchId?.name ?? '—',
            alias: admin.churchId?.alias ?? 'CH',
          }
        : null,
    };
  }

  async findFirstSuperAdminByChurch(churchId: Types.ObjectId) {
    const superRole = await this.rolesService.findOne('Super Admin');
    if (!superRole) {
      return null;
    }

    const admin = await this.adminModel
      .findOne({
        churchId: new Types.ObjectId(churchId),
        churchRole: superRole._id,
      })
      .sort({ createdAt: 1 })
      .lean();

    if (!admin) {
      return null;
    }

    return this.mapAdmin(admin);
  }

  async updateAdminProfile(id: Types.ObjectId, updateData: Partial<Admin>) {
    const updated = await this.adminModel
      .findByIdAndUpdate(
        id,
        {
          $set: {
            ...updateData,
            ...(updateData.email && {
              email: updateData.email.toLowerCase().trim(),
            }),
          },
        },
        {
          new: true,
          runValidators: true,
        },
      )
      .lean();

    if (!updated) {
      throw new NotFoundException('Admin not found');
    }

    return {
      id: updated._id.toString(),
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
    };
  }

  async existsInChurch(adminId: string, churchId: Types.ObjectId) {
    return await this.adminModel.exists({
      _id: new Types.ObjectId(adminId),
      churchId,
    });
  }
}
