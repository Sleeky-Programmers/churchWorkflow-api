import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, Document } from 'mongoose';
import { ProductAdmin } from './product-admin.schema';
import { Church } from './church.schema';
@Schema({ timestamps: true })
export class AdminActivityLog extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: ProductAdmin.name })
  adminId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop()
  action: string;

  @Prop()
  details: string;

  @Prop()
  plan?: string;
}

export const AdminActivityLogSchema =
  SchemaFactory.createForClass(AdminActivityLog);
