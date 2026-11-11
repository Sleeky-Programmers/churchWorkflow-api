import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, Document } from 'mongoose';
import { Church } from './church.schema';
import { AdminInviteStatus, ChurchProduct } from '../common/utils/enums.utils';
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

  // Which app the invite came from, so its emails link back to that app.
  @Prop({
    type: String,
    enum: ChurchProduct,
    default: ChurchProduct.CHURCH_WORKFLOW,
  })
  product: ChurchProduct;

  // The branch the invite gives access to when accepted (Service Timer
  // Invites set the inviter's branch; Church Workflow grants access later).
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Branch', default: null })
  branchId: Types.ObjectId | null;
}

export const InviteSchema = SchemaFactory.createForClass(Invite);
