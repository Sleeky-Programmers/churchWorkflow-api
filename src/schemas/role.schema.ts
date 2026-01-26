import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { SchemaTypes, Types, Document } from 'mongoose';
import { Church } from './church.schema';
import { RoleStatus, RoleType } from '../common/utils/enums.utils';
import {
  SectionPermission,
  SectionPermissionSchema,
} from './permission.schema';

@Schema()
export class Role extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop()
  roleName: string;

  @Prop({ default: null })
  description: string;

  @Prop({ default: RoleType.CUSTOM })
  type: string;

  @Prop({ default: RoleStatus.ACTIVE })
  status: RoleStatus;

  @Prop({ type: [SectionPermissionSchema], default: [] })
  permissions: SectionPermission[];
}

export const RoleSchema = SchemaFactory.createForClass(Role);
