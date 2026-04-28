import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class ModulePermissions {
  @Prop({ default: false })
  create: boolean;

  @Prop({ default: false })
  read: boolean;

  @Prop({ default: false })
  update: boolean;

  @Prop({ default: false })
  delete: boolean;
}

@Schema({ timestamps: true })
export class ProductAdminRole extends Document {
  @Prop()
  name: string;

  @Prop({ type: Object, default: null })
  permissions: Record<string, ModulePermissions>;
}

export const ProductAdminRoleSchema =
  SchemaFactory.createForClass(ProductAdminRole);
