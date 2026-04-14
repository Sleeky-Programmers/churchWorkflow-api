import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ProductAdminService } from './product-admin.service';
import { ProductAdminController } from './product-admin.controller';
import {
  ProductAdmin,
  ProductAdminSchema,
} from '../../schemas/product-admin.schema';
import { ProductJwtStrategy } from './strategy/product-jwt.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductAdmin.name, schema: ProductAdminSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('productAdmin.jwtSecret'),
        signOptions: {
          expiresIn: config.get('productAdmin.jwtExpiresIn'),
        },
      }),
    }),
  ],
  controllers: [ProductAdminController],
  providers: [ProductAdminService, ProductJwtStrategy],
  exports: [ProductAdminService],
})
export class ProductAdminModule {}
