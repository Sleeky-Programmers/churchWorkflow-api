export enum ChurchRole {
  GENERAL_OVERSEER = 'GENERAL_OVERSEER',
  SENIOR_PASTOR = 'SENIOR_PASTOR',
  PASTOR = 'PASTOR',
  CHURCH_ADMINISTRATOR = 'CHURCH_ADMINISTRATOR',
  CELL_LEADER = 'CELL_LEADER',
  FELLOWSHIP_GROUP_LEADER = 'FELLOWSHIP_GROUP_LEADER',
}

export enum ServiceDay {
  SUNDAY = 'SUNDAY',
  MONDAY = 'MONDAY',
  TUESDAY = 'TUESDAY',
  WEDNESDAY = 'WEDNESDAY',
  THURSDAY = 'THURSDAY',
  FRIDAY = 'FRIDAY',
  SATURDAY = 'SATURDAY',
}

export enum ServiceType {
  REGULAR = 'REGULAR',
  SPECIAL = 'SPECIAL',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum MaritalStatus {
  MARRIED = 'MARRIED',
  SINGLE = 'SINGLE',
}

export enum MembershipStatus {
  VISITOR = 'VISITOR',
  MEMBER = 'MEMBER',
  VOLUNTEER = 'VOLUNTEER',
  LEADER = 'LEADER',
}

export enum AdminInviteStatus {
  PENDING = 'PENDING',
  DECLINED = 'DECLINED',
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum InviteEmailType {
  INVITE = 'INVITE',
  ROLE_CHANGE = 'ROLE_CHANGE',
}

export enum AdminOptions {
  SUSPEND = 'SUSPEND',
  RESTORE = 'RESTORE',
}

export enum RoleStatus {
  ACTIVE = 'ACTIVE',
  DISABLED = 'DISABLED',
}

export enum RoleType {
  SYSTEM = 'SYSTEM',
  CUSTOM = 'CUSTOM',
}

export enum AccessLevel {
  NO_ACCESS = 'NO_ACCESS',
  VIEW = 'VIEW',
  MANAGE = 'MANAGE',
  FULL_ACCESS = 'FULL_ACCESS',
}

export enum ModuleSections {
  MEMBERS = 'MEMBERS',
  GIVING = 'GIVING',
  GIVING_AND_EXPENSES = 'GIVING_AND_EXPENSES',
  REQUESTS = 'REQUESTS',
  EVENTS = 'EVENTS',
  DEPARTMENTS = 'DEPARTMENTS',
  ATTENDANCE = 'ATTENDANCE',
}

export enum NotificationType {
  REQUISITION = 'REQUISITION',
  MESSAGE = 'MESSAGE',
  ROLE_UPDATE = 'ROLE_UPDATE',
  BIRTHDAY = 'BIRTHDAY',
  SUBSCRIPTION = 'SUBSCRIPTION',
  MEMBER = 'MEMBER',
  FINANCE = 'FINANCE',
}

export enum MemberTitle {
  MR = 'MR.',
  MRS = 'MRS.',
  MISS = 'MISS',
  DR = 'DR.',
  PASTOR = 'PASTOR',
  REV = 'REV.',
}

export enum AccountDeletionStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum MemberFilter {
  ALL = 'all',
  MALE = 'male',
  FEMALE = 'female',
  THIS_MONTH = 'this-month',
  NEW_MEMBERS = 'new-members',
  IS_BAPTIZED = 'isBaptized',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
}

export enum SmallTeamStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}