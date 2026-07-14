import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class ProductAdminJwtAuthGuard extends AuthGuard('product-jwt') {}
