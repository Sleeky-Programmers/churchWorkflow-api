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

  // Null = visible to everyone in the church; set = only that admin sees it.
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Admin', default: null })
  recipientId: Types.ObjectId | null;

  @Prop({ default: false })
  isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
