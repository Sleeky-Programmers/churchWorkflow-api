import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Otp extends Document {
  @Prop()
  email: string;

  @Prop()
  otp: number;

  @Prop()
  otpExpiry: Date;

  @Prop({ default: false })
  isUsed: boolean;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);
