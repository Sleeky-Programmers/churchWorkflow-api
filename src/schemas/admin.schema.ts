import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { ChurchRole } from '../common/utils/enums.utils';
import { SchemaTypes, Types, Document } from 'mongoose';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Admin extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop()
  churchRole: ChurchRole;

  @Prop()
  phoneNumber: string;

  @Prop()
  email: string;

  @Prop({ select: false })
  password: string;

  @Prop({ default: false })
  isVerified: boolean;
}

export const AdminSchema = SchemaFactory.createForClass(Admin);
