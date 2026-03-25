import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, Document } from 'mongoose';
import { Church } from './church.schema';
import { Role } from './role.schema';

@Schema({ timestamps: true })
export class Admin extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Role.name })
  churchRole: Types.ObjectId;

  @Prop({ default: null })
  title: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop({ default: null })
  phoneNumber: string;

  @Prop()
  email: string;

  @Prop({ select: false })
  password: string;

  @Prop({ default: false })
  isVerified: boolean;

  @Prop({ select: false, default: null })
  refreshToken?: string;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
