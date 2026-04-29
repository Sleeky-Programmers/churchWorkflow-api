import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ProductAdminRole } from '../../schemas/product-admin-role.schema';
import { DefaultProductAdminRoles } from '../../common/utils/enums.utils';
import { CreateProductAdminRoleDto } from './dto/create-product-admin-role';

@Injectable()
export class ProductAdminRolesService {
  constructor(
    @InjectModel(ProductAdminRole.name)
    private roleModel: Model<ProductAdminRole>,
  ) {}

  async create(data: CreateProductAdminRoleDto) {
    return this.roleModel.create(data);
  }

  async findByName(name: string) {
    return this.roleModel.findOne({ name });
  }

  async findById(id: string) {
    return this.roleModel.findById(id);
  }

  async list() {
    return this.roleModel.find().sort({ createdAt: -1 });
  }

  async seedDefaultRoles() {
    const defaults = [
      {
        name: DefaultProductAdminRoles.SUPER_ADMIN,
        permissions: {
          CHURCH_MANAGEMENT: {
            create: true,
            read: true,
            update: true,
            delete: true,
          },
          USER_MANAGEMENT: {
            create: true,
            read: true,
            update: true,
            delete: true,
          },
          PAYMENT_MANAGEMENT: {
            create: true,
            read: true,
            update: true,
            delete: true,
          },
          COUPON_MANAGEMENT: {
            create: true,
            read: true,
            update: true,
            delete: true,
          },
        },
      },
      {
        name: DefaultProductAdminRoles.FINANCE_ADMIN,
        permissions: {
          CHURCH_MANAGEMENT: {
            create: false,
            read: true,
            update: false,
            delete: false,
          },
          USER_MANAGEMENT: {
            create: false,
            read: true,
            update: false,
            delete: false,
          },
          PAYMENT_MANAGEMENT: {
            create: true,
            read: true,
            update: true,
            delete: false,
          },
          COUPON_MANAGEMENT: {
            create: true,
            read: true,
            update: true,
            delete: false,
          },
        },
      },
      {
        name: DefaultProductAdminRoles.SUPPORT_ADMIN,
        permissions: {
          CHURCH_MANAGEMENT: {
            create: false,
            read: true,
            update: true,
            delete: false,
          },
          USER_MANAGEMENT: {
            create: true,
            read: true,
            update: true,
            delete: false,
          },
          PAYMENT_MANAGEMENT: {
            create: false,
            read: true,
            update: false,
            delete: false,
          },
          COUPON_MANAGEMENT: {
            create: false,
            read: true,
            update: false,
            delete: false,
          },
        },
      },
    ];

    for (const defaultRole of defaults) {
      const exists = await this.roleModel.findOne({ name: defaultRole.name });
      if (!exists) {
        await this.roleModel.create(defaultRole);
      }
    }
  }
}
