import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { ProductAdminStatus } from '../common/utils/enums.utils';
import { ProductAdminRole } from './product-admin-role.schema';

@Schema({ timestamps: true })
export class ProductAdmin extends Document {
  @Prop()
  name: string;

  @Prop()
  email: string;

  @Prop()
  password: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: ProductAdminRole.name })
  role: Types.ObjectId;

  @Prop({ default: ProductAdminStatus.ACTIVE })
  status: string;
}

export const ProductAdminSchema = SchemaFactory.createForClass(ProductAdmin);
