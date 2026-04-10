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

export type ChurchDetails = {
  _id: Types.ObjectId;
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
  totalMembers: number;
  totalUsers: number;
  subscription: any;
};
