import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Church } from './church.schema';
import { Member } from './member.schema';
import { Admin } from './admin.schema';
import { SmallTeamStatus } from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class SmallTeam extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  leaderId: Types.ObjectId | null;

  @Prop({ type: [SchemaTypes.ObjectId], ref: Member.name, default: [] })
  memberIds: Types.ObjectId[];

  @Prop({
    type: String,
    enum: Object.values(SmallTeamStatus),
    default: SmallTeamStatus.ACTIVE,
  })
  status: SmallTeamStatus;

  @Prop({ default: '' })
  description: string;
}

export const SmallTeamSchema = SchemaFactory.createForClass(SmallTeam);
