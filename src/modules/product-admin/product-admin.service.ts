import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { ProductAdmin } from '../../schemas/product-admin.schema';
import { ProductAdminRolesService } from '../product-admin-roles/product-admin-roles.service';
import { ProductAdminInvite } from '../../schemas/product-admin-invite.schema';
import {
  paginationMeta,
  PaginationBaseDto,
} from '../../common/helpers/pagination.helper';
import {
  DefaultProductAdminRoles,
  ProductAdminInviteStatus,
  ProductAdminStatus,
} from '../../common/utils/enums.utils';

@Injectable()
export class ProductAdminService implements OnModuleInit {
  constructor(
    @InjectModel(ProductAdmin.name)
    private productAdminModel: Model<ProductAdmin>,
    @InjectModel(ProductAdminInvite.name)
    private inviteModel: Model<ProductAdminInvite>,
    private configService: ConfigService,
    private rolesService: ProductAdminRolesService,
  ) {}

  async onModuleInit() {
    await this.rolesService.seedDefaultRoles();

    const count = await this.productAdminModel.countDocuments();
    if (count === 0) {
      const name = this.configService.get<string>('productAdmin.seedName');
      const email = this.configService.get<string>('productAdmin.seedEmail');
      const password = this.configService.get<string>(
        'productAdmin.seedPassword',
      );

      const hashed = bcrypt.hashSync(password, 10);

      const superRole = await this.rolesService.findByName(
        DefaultProductAdminRoles.SUPER_ADMIN,
      );

      await this.productAdminModel.create({
        name,
        email,
        password: hashed,
        role: superRole?._id,
      });
    }
  }

  async findOne(email: string) {
    return await this.productAdminModel.findOne({ email });
  }

  async findById(id: string) {
    return await this.productAdminModel.findById(id).populate('role');
  }

  async validateCredentials(email: string, password: string) {
    const user = await this.findOne(email);
    if (!user) {
      return null;
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return null;
    }

    const { password: _, ...rest } = user.toObject();
    return rest as unknown as ProductAdmin;
  }

  async inviteAdmin(email: string, roleId: string) {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invite = await this.inviteModel.create({
      email,
      role: new Types.ObjectId(roleId),
      token,
      expiresAt,
    });

    return invite;
  }

  async acceptInvite(token: string, name: string, password: string) {
    const invite = await this.inviteModel.findOne({
      token,
      status: ProductAdminInviteStatus.PENDING,
    });
    if (!invite) {
      throw new Error('Invalid or expired invite');
    }
    if (invite.expiresAt && invite.expiresAt < new Date()) {
      throw new Error('Invite expired');
    }

    const hashed = bcrypt.hashSync(password, 10);

    const created = await this.productAdminModel.create({
      name,
      email: invite.email,
      password: hashed,
      role: invite.role,
    });

    invite.status = ProductAdminInviteStatus.ACCEPTED;
    await invite.save();

    return created;
  }

  async blockAdmin(id: string) {
    return this.productAdminModel.findByIdAndUpdate(
      id,
      { status: ProductAdminStatus.BLOCKED },
      { new: true },
    );
  }

  async unblockAdmin(id: string) {
    return this.productAdminModel.findByIdAndUpdate(
      id,
      { status: ProductAdminStatus.ACTIVE },
      { new: true },
    );
  }

  async stats() {
    const total = await this.productAdminModel.countDocuments();
    const active = await this.productAdminModel.countDocuments({
      status: ProductAdminStatus.ACTIVE,
    });
    const blocked = await this.productAdminModel.countDocuments({
      status: ProductAdminStatus.BLOCKED,
    });
    const superRole = await this.rolesService.findByName(
      DefaultProductAdminRoles.SUPER_ADMIN,
    );
    const superCount = superRole
      ? await this.productAdminModel.countDocuments({ role: superRole._id })
      : 0;

    return { total, active, blocked, superAdmins: superCount };
  }

  async list(filter: PaginationBaseDto & { role?: string; status?: string }) {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (filter.role) {
      query.role = new Types.ObjectId(filter.role);
    }
    if (filter.status) {
      query.status = filter.status;
    }

    const [data, itemCount] = await Promise.all([
      this.productAdminModel
        .find(query)
        .populate('role')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.productAdminModel.countDocuments(query),
    ]);

    return { data, pagination: paginationMeta({ page, limit, itemCount }) };
  }
}
