import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import { Branch } from './branch.schema';
import { Church } from './church.schema';

export const TIMER_FONTS = ['condensed', 'modern', 'serif', 'rounded'] as const;
export type TimerFont = (typeof TIMER_FONTS)[number];

@Schema({ _id: false })
export class TimerColors {
  @Prop({ default: '#0c1a4d' }) bg: string;
  @Prop({ default: '#f6f4ee' }) text: string;
  @Prop({ default: '#3f63e0' }) accent: string;
  @Prop({ default: '#e9b949' }) warn: string;
  @Prop({ default: '#ff4545' }) over: string;
}
export const TimerColorsSchema = SchemaFactory.createForClass(TimerColors);

/** The 11 display elements, each optional (Product Plan, section 3.5). */
@Schema({ _id: false })
export class TimerShow {
  @Prop({ default: true }) timeLeft: boolean;
  @Prop({ default: true }) overTime: boolean;
  @Prop({ default: true }) labels: boolean;
  @Prop({ default: true }) progress: boolean;
  @Prop({ default: true }) item: boolean;
  @Prop({ default: true }) person: boolean;
  @Prop({ default: true }) next: boolean;
  @Prop({ default: true }) schedule: boolean;
  @Prop({ default: true }) clock: boolean;
  @Prop({ default: true }) church: boolean;
  @Prop({ default: true }) logo: boolean;
}
export const TimerShowSchema = SchemaFactory.createForClass(TimerShow);

/**
 * Service Timer settings for one branch: what the display shows and how it
 * looks, plus the operator PIN and the secret display link.
 */
@Schema({ timestamps: true })
export class TimerSettings extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name, required: true })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, required: true })
  branchId: Types.ObjectId;

  // Name shown on the display. Null means "use the church's name".
  @Prop({ type: String, default: null })
  churchName: string | null;

  // Start time used for a brand-new session, "HH:MM".
  @Prop({ default: '09:00' })
  serviceStart: string;

  @Prop({ default: 2 })
  warnMin: number;

  @Prop({ default: true })
  keepRunning: boolean;

  // Off by default: shortcuts firing while someone typed caused real problems.
  @Prop({ default: false })
  shortcuts: boolean;

  @Prop({ type: String, enum: TIMER_FONTS, default: 'condensed' })
  font: TimerFont;

  @Prop({ type: TimerColorsSchema, default: () => ({}) })
  colors: TimerColors;

  @Prop({ type: TimerShowSchema, default: () => ({}) })
  show: TimerShow;

  // Timer-specific logo. Null means "use the church's logo".
  @Prop({ type: String, default: null })
  logoUrl: string | null;

  @Prop({ type: String, default: null })
  logoPublicId: string | null;

  // Secret for the display link (/d/<token>), which needs no login.
  @Prop({ required: true, unique: true })
  displayToken: string;

  @Prop({ type: String, default: null, select: false })
  operatorPinHash: string | null;

  // Bumped whenever the PIN or display link changes, so operator tokens
  // Issued before that stop working.
  @Prop({ default: 0 })
  pinVersion: number;

  @Prop({ default: 0 })
  failedPinAttempts: number;

  @Prop({ type: Date, default: null })
  pinLockedUntil: Date | null;
}

export const TimerSettingsSchema = SchemaFactory.createForClass(TimerSettings);

TimerSettingsSchema.index({ churchId: 1, branchId: 1 }, { unique: true });
