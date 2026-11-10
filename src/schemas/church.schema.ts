import { Document, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { ChurchProduct } from '../common/utils/enums.utils';

@Schema({ timestamps: true })
export class Church extends Document {
  @Prop()
  name: string;

  @Prop({ default: null })
  alias: string;

  // Non-sensitive public identifier used for public-facing URLs (e.g. the
  // Online giving pages) so we never expose the raw churchId externally.
  @Prop({ unique: true, sparse: true, default: null })
  slug: string;

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

  @Prop({ default: null })
  logoPublicId: string;

  // Products the church signed up through. Churches created before this
  // Field existed have none recorded and are Church Workflow churches.
  @Prop({
    type: [String],
    enum: ChurchProduct,
    default: [ChurchProduct.CHURCH_WORKFLOW],
  })
  products: ChurchProduct[];

  @Prop({ default: false })
  isBlocked: boolean;

  @Prop({ default: null })
  blockedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'ProductAdmin', default: null })
  blockedBy: Types.ObjectId;

  @Prop({ default: null })
  blockReason: string;

  @Prop({ default: null })
  unblockedAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'ProductAdmin', default: null })
  unblockedBy: Types.ObjectId;

  @Prop({ default: [] })
  blockHistory: {
    action: string;
    performedBy: Types.ObjectId;
    reason?: string;
    timestamp: Date;
    note?: string;
  }[];
}

export const ChurchSchema = SchemaFactory.createForClass(Church);
