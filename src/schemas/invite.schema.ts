import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, Document } from 'mongoose';
import { Church } from './church.schema';
import { AdminInviteStatus } from '../common/utils/enums.utils';
import { Role } from './role.schema';

@Schema({ timestamps: true })
export class Invite extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Role.name })
  churchRole: Types.ObjectId;

  @Prop()
  title: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop()
  email: string;

  @Prop({ default: AdminInviteStatus.PENDING })
  status: AdminInviteStatus;
}

export const InviteSchema = SchemaFactory.createForClass(Invite);
