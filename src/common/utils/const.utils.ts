import {
  Gender,
  MaritalStatus,
  MembershipStatus,
  MemberTitle,
} from './enums.utils';

export const TITLE_MAP: Record<string, MemberTitle> = {
  MR: MemberTitle.MR,
  'MR.': MemberTitle.MR,
  MRS: MemberTitle.MRS,
  'MRS.': MemberTitle.MRS,
  MISS: MemberTitle.MISS,
  'MISS.': MemberTitle.MISS,
  MS: MemberTitle.MISS,
  'MS.': MemberTitle.MISS,
  DR: MemberTitle.DR,
  'DR.': MemberTitle.DR,
  PASTOR: MemberTitle.PASTOR,
  'PASTOR.': MemberTitle.PASTOR,
  REV: MemberTitle.REV,
  'REV.': MemberTitle.REV,
};

export const GENDER_MAP: Record<string, Gender> = {
  MALE: Gender.MALE,
  M: Gender.MALE,
  FEMALE: Gender.FEMALE,
  F: Gender.FEMALE,
};

export const MARITAL_STATUS_MAP: Record<string, MaritalStatus | null> = {
  MARRIED: MaritalStatus.MARRIED,
  SINGLE: MaritalStatus.SINGLE,
  DIVORCED: null,
  WIDOWED: null,
};

export const MEMBERSHIP_STATUS_MAP: Record<string, MembershipStatus> = {
  MEMBER: MembershipStatus.MEMBER,
  ACTIVE: MembershipStatus.MEMBER,
  'NEW MEMBER': MembershipStatus.MEMBER,
  VOLUNTEER: MembershipStatus.VOLUNTEER,
  LEADER: MembershipStatus.LEADER,
  VISITOR: MembershipStatus.VISITOR,
  INACTIVE: MembershipStatus.VISITOR,
};
