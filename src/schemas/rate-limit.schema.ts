import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class RateLimit extends Document {
  @Prop()
  ip: string;

  @Prop({ default: 1 })
  count: number;

  @Prop({ default: Date.now })
  lastRequestAt: Date;
}

export const RateLimitSchema = SchemaFactory.createForClass(RateLimit);
