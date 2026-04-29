import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ProductAdminService } from '../product-admin.service';

@Injectable()
export class ProductJwtStrategy extends PassportStrategy(
  Strategy,
  'product-jwt',
) {
  constructor(
    private readonly productAdminService: ProductAdminService,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('productAdmin.jwtSecret')!,
    });
  }

  async validate(payload: any) {
    const user = await this.productAdminService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Product admin not found');
    }

    return user;
  }
}
