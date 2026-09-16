import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';
import { Branch } from './branch.schema';
import { Church } from './church.schema';
import { Member } from './member.schema';
import { Admin } from './admin.schema';
import { SmallTeamStatus } from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class SmallTeam extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: SchemaTypes.ObjectId, ref: Admin.name, default: null })
  leaderId: Types.ObjectId | null;

  // Set when a team is created/edited with "invite new leader" instead of an
  // Existing admin - resolved to leaderId automatically once that invite is
  // Accepted (see SmallTeamsService.resolvePendingLeader).
  @Prop({ default: null, lowercase: true, trim: true })
  pendingLeaderEmail: string | null;

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

SmallTeamSchema.index({ churchId: 1, branchId: 1 });
