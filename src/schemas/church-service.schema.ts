import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Church } from './church.schema';
import {
  ServiceDay,
  ServiceType,
  Recurrence,
  EventType,
  ReminderType,
  ReminderTimeBefore,
} from '../common/utils/enums.utils';

@Schema({ _id: false })
class SpecialDay {
  @Prop()
  date: Date;

  @Prop()
  startTime: string;

  @Prop()
  endTime?: string;
}

@Schema({ timestamps: true })
export class ChurchService extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop()
  title: string;

  @Prop({ enum: Recurrence })
  recurrence?: Recurrence;

  @Prop({ enum: EventType })
  eventType?: EventType;

  @Prop({ enum: ServiceType })
  type: ServiceType;

  @Prop({ enum: ServiceDay })
  day?: ServiceDay;

  @Prop()
  startDate?: Date;

  @Prop()
  endDate?: Date;

  @Prop()
  description?: string;

  @Prop({ type: [SpecialDay], default: [] })
  specialDays?: SpecialDay[];

  @Prop()
  startTime: string;

  @Prop()
  endTime?: string;

  @Prop()
  location?: string;

  @Prop({ default: false })
  reminderEnabled?: boolean;

  @Prop({ enum: ReminderType })
  reminderType?: ReminderType;

  @Prop({ enum: ReminderTimeBefore })
  reminderTimeBefore?: ReminderTimeBefore;
}

export const ChurchServiceSchema = SchemaFactory.createForClass(ChurchService);
