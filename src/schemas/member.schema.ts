import { Document, SchemaTypes, Types } from 'mongoose';

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

import {
  Gender,
  MaritalStatus,
  MembershipStatus,
} from '../common/utils/enums.utils';
import { Branch } from './branch.schema';
import { Church } from './church.schema';

@Schema({ timestamps: true })
export class Member extends Document {
  @Prop({ type: SchemaTypes.ObjectId, ref: Church.name })
  churchId: Types.ObjectId;

  @Prop({ type: SchemaTypes.ObjectId, ref: Branch.name, default: null })
  branchId: Types.ObjectId | null;

  // Free text (see CreateMemberDto) rather than a fixed enum.
  @Prop({ default: null })
  title: string | null;

  @Prop()
  fullName: string;

  @Prop()
  gender: Gender;

  @Prop()
  birthday: Date;

  @Prop({ default: null })
  maritalStatus: MaritalStatus;

  @Prop({ default: null })
  dateOfMarriage: Date;

  @Prop({ default: null })
  phoneNumber: string;

  @Prop({ default: null })
  email: string;

  @Prop({ default: null })
  occupation: string;

  @Prop({ default: null })
  educationalBackground: string;

  @Prop({ default: null })
  address: string;

  @Prop({ default: null })
  membershipStatus: MembershipStatus;

  @Prop({ default: null })
  dateJoined: Date;

  @Prop({ default: null })
  previousChurchMembership: string;

  @Prop({ default: null })
  isBaptized: boolean;

  @Prop({ default: null })
  ministries: string;

  @Prop({ default: null })
  volunteerPreferences: string;

  @Prop({ default: null })
  cellGroupName: string;

  @Prop({ default: false })
  isActive: boolean;

  /**
   * Set when an inactive guest (VISITOR) is auto-archived. Archived people are
   * hidden from every member query (see the middleware below) and count
   * towards no limit. They are permanently deleted 12 months after archiving.
   */
  @Prop({ type: Date, default: null })
  archivedAt: Date | null;

  /** When the church was warned (in-app + email) that this archived guest will be deleted in 30 days. */
  @Prop({ type: Date, default: null })
  archiveDeletionWarnedAt: Date | null;

  /** When the church was prompted to convert this guest after 4+ services in 60 days. */
  @Prop({ type: Date, default: null })
  frequentGuestNotifiedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export const MemberSchema = SchemaFactory.createForClass(Member);

MemberSchema.index({ churchId: 1, branchId: 1 });
MemberSchema.index({ churchId: 1, archivedAt: 1, membershipStatus: 1 });

/**
 * Archived guests are invisible by default. Any query whose filter mentions
 * `archivedAt` (or that passes the `includeArchived` option) opts out, which is
 * how the archive list, restore, and the lifecycle job reach them. Deletes are
 * not filtered.
 */
const ARCHIVE_FILTERED_QUERIES = [
  'find',
  'findOne',
  'countDocuments',
  'findOneAndUpdate',
  'updateOne',
  'updateMany',
  'distinct',
] as const;

for (const op of ARCHIVE_FILTERED_QUERIES) {
  MemberSchema.pre(op as any, function (this: any) {
    if (this.getOptions?.().includeArchived) {
      return;
    }
    const filter = this.getFilter?.() ?? {};
    if (!Object.prototype.hasOwnProperty.call(filter, 'archivedAt')) {
      this.where({ archivedAt: null });
    }
  });
}

MemberSchema.pre('aggregate', function (this: any) {
  if (this.options?.includeArchived) {
    return;
  }
  const pipeline = this.pipeline();
  const first = pipeline[0];
  if (first?.$match && 'archivedAt' in first.$match) {
    return;
  }
  pipeline.unshift({ $match: { archivedAt: null } });
});
