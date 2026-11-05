import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Branch } from './branch.schema';
import { Church } from './church.schema';
import { ChurchService } from './church-service.schema';
import { Member } from './member.schema';
import { Admin } from './admin.schema';
import { AttendanceStatus } from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class Attendance extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: ChurchService.name })
  churchServiceId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, default: null })
  churchId: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  @Prop()
  date: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Member.name })
  memberId: Types.ObjectId;

  @Prop({ default: AttendanceStatus.ABSENT })
  status: AttendanceStatus;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name })
  recordedBy: Types.ObjectId;
}

export const AttendanceSchema = SchemaFactory.createForClass(Attendance);

AttendanceSchema.index({ churchId: 1, branchId: 1 });
// Guest rules: "4+ services in 60 days" and "last attended" lookups.
AttendanceSchema.index({ churchId: 1, status: 1, date: 1, memberId: 1 });
AttendanceSchema.index({ memberId: 1, status: 1, date: -1 });
