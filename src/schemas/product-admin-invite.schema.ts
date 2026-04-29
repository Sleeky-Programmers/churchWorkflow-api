import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { ProductAdminRole } from './product-admin-role.schema';
import { ProductAdminInviteStatus } from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class ProductAdminInvite extends Document {
  @Prop()
  email: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: ProductAdminRole.name })
  role: Types.ObjectId;

  @Prop()
  token: string;

  @Prop({ default: ProductAdminInviteStatus.PENDING })
  status: string;

  @Prop()
  expiresAt: Date;
}

export const ProductAdminInviteSchema =
  SchemaFactory.createForClass(ProductAdminInvite);
