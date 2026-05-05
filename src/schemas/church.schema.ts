import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { ChurchStatus } from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class Church extends Document {
  @Prop()
  name: string;

  @Prop({ default: null })
  alias: string;

  @Prop({ default: null })
  address: string;

  @Prop({ default: null })
  country: string;

  @Prop({ default: null })
  state: string;

  @Prop({ default: null })
  defaultCurrency: string;

  @Prop({ default: null })
  timeZone: string;

  @Prop({ default: null })
  logoUrl: string;

  @Prop({ default: ChurchStatus.ACTIVE })
  status: string;
}

export const ChurchSchema = SchemaFactory.createForClass(Church);
