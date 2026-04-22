import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, Document } from 'mongoose';
import { Church } from './church.schema';
import { NotificationType } from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class Notification extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop()
  title: string;

  @Prop()
  body: string;

  @Prop()
  type: NotificationType;

  @Prop({ default: false })
  isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
