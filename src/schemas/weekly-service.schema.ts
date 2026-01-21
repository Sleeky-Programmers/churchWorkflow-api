import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { WeeklyServiceDay } from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class WeeklyService extends Document {
  @Prop()
  serviceName: string;

  @Prop()
  day: WeeklyServiceDay;

  @Prop()
  startTime: string;

  @Prop()
  endTime: string;

  @Prop()
  location: string;
}

export const WeeklyServiceSchema = SchemaFactory.createForClass(WeeklyService);
