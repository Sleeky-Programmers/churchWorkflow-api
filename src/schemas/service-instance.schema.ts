import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { ChurchService } from './church-service.schema';

@Schema({ timestamps: true })
export class ServiceInstance extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: ChurchService.name })
  masterServiceId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: ChurchService.name })
  churchId: Types.ObjectId;

  @Prop()
  date: Date;

  @Prop()
  title: string;

  @Prop()
  startTime: string;

  @Prop()
  endTime?: string;

  @Prop()
  location?: string;

  @Prop()
  type?: string;

  @Prop({ default: true })
  createdFromRecurring?: boolean;
  @Prop({ default: false })
  reminderEnabled?: boolean;

  @Prop()
  reminderType?: string;

  @Prop()
  reminderTimeBefore?: string;

  @Prop({ default: false })
  reminderSent?: boolean;
}

export const ServiceInstanceSchema =
  SchemaFactory.createForClass(ServiceInstance);
