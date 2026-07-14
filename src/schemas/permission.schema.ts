import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ModuleSections, AccessLevel } from '../common/utils/enums.utils';

@Schema({ _id: false })
export class SectionPermission extends Document {
  @Prop({ enum: ModuleSections })
  moduleSection: ModuleSections;

  @Prop({ enum: AccessLevel })
  accessLevel: AccessLevel;
}

export const SectionPermissionSchema =
  SchemaFactory.createForClass(SectionPermission);
