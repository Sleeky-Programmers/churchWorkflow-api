import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { ConfigService } from '@nestjs/config';
import { ProductAdmin } from '../../schemas/product-admin.schema';

@Injectable()
export class ProductAdminService implements OnModuleInit {
  constructor(
    @InjectModel(ProductAdmin.name)
    private productAdminModel: Model<ProductAdmin>,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const count = await this.productAdminModel.countDocuments();
    if (count === 0) {
      const name = this.configService.get<string>('productAdmin.seedName');
      const email = this.configService.get<string>('productAdmin.seedEmail');
      const password = this.configService.get<string>(
        'productAdmin.seedPassword',
      );

      const hashed = bcrypt.hashSync(password, 10);

      await this.productAdminModel.create({
        name,
        email,
        password: hashed,
      });
    }
  }

  async findOne(email: string) {
    return await this.productAdminModel.findOne({ email });
  }

  async findById(id: string) {
    return await this.productAdminModel.findById(id);
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
}
