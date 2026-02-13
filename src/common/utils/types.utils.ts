import { Types } from 'mongoose';

export type InvitePayload = {
  churchId: Types.ObjectId;
  title?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  churchRole: string;
  churchRoleId: Types.ObjectId;
};
