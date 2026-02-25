import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { ChurchService } from './church-service.schema';
import { Member } from './member.schema';
import { Admin } from './admin.schema';

@Schema({ timestamps: true })
export class Attendance extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: ChurchService.name })
  churchServiceId: Types.ObjectId;

  @Prop()
  date: Date;

  @Prop({
    type: [{ type: SchemaTypes.ObjectId, ref: Member.name }],
    default: [],
  })
  attendees: Types.ObjectId[];

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name })
  recordedBy: Types.ObjectId;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);
