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

export enum Recurrence {
  NO_REPEAT = 'NO_REPEAT',
  DAILY = 'DAILY',
  WEEKLY_MONDAY = 'WEEKLY_MONDAY',
  MONTHLY_FIRST_MONDAY = 'MONTHLY_FIRST_MONDAY',
  ANNUALLY = 'ANNUALLY',
  WEEKDAYS = 'WEEKDAYS',
}

export enum EventType {
  WORSHIP_SERVICE = 'WORSHIP_SERVICE',
  BIRTHDAY = 'BIRTHDAY',
  MEETING = 'MEETING',
  WEDDING_ANNIVERSARY = 'WEDDING_ANNIVERSARY',
  OTHERS = 'OTHERS',
}

export enum ReminderType {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
}

export enum ReminderTimeBefore {
  MINUTES_30 = 'MINUTES_30',
  HOUR_1 = 'HOUR_1',
}

export enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
}

export enum MaritalStatus {
  MARRIED = 'MARRIED',
  SINGLE = 'SINGLE',
  DIVORCED = 'DIVORCED',
  WIDOWED = 'WIDOWED',
}

export enum MembershipStatus {
  VISITOR = 'VISITOR',
  MEMBER = 'MEMBER',
  VOLUNTEER = 'VOLUNTEER',
  WORKER = 'WORKER',
  LEADER = 'LEADER',
  CONVERT = 'NEW CONVERT',
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

export enum DepartmentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum DepartmentMemberAction {
  ADD = 'ADD',
  REMOVE = 'REMOVE',
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
  CHURCH = 'CHURCH',
  SUBSCRIPTION = 'SUBSCRIPTION',
  PAYMENTS = 'PAYMENTS',
  PAYMENT = 'PAYMENT',
  ADMIN = 'ADMIN',
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
  NONE = 'NONE',
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
  MARRIED = 'married',
  SINGLE = 'single',
  DIVORCED = 'divorced',
  WIDOWED = 'widowed',
  VISITOR = 'visitor',
  MEMBER = 'member',
  WORKER = 'worker',
  VOLUNTEER = 'volunteer',
  LEADER = 'leader',
  CONVERT = 'new-convert',
  NEW_MEMBERS = 'new-members',
  IS_BAPTIZED = 'is-baptized',
}

export enum CouponFilter {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  EXPIRED = 'expired',
}
export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
}

export enum SmallTeamStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

export enum BillingCycle {
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PlanType {
  STARTER = 'STARTER',
  GROWTH = 'GROWTH',
  EXPANSION = 'EXPANSION',
  ENTERPRISE = 'ENTERPRISE',
}

export enum SubscriptionStatus {
  ACTIVE = 'ACTIVE',
  GRACE = 'GRACE',
  EXPIRED = 'EXPIRED',
  TRIAL = 'TRIAL',
}

export enum ChurchSubscriptionStatus {
  ACTIVE = 'Active',
  OVERDUE = 'Overdue',
  EXPIRING_SOON = 'Expiring soon',
}

export enum MemberLimitType {
  NONE = 'NONE',
  BLOCK = 'BLOCK',
  WARNING = 'WARNING',
}

export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FLAT = 'FLAT',
}

export enum PaymentProvider {
  PAYSTACK = 'paystack',
  FLUTTERWAVE = 'flutterwave',
}

export enum PaymentTimeframe {
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
}

export enum ProductAdminStatus {
  ACTIVE = 'ACTIVE',
  BLOCKED = 'BLOCKED',
}

export enum ProductAdminInviteStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
}

export enum DefaultProductAdminRoles {
  SUPER_ADMIN = 'SUPER_ADMIN',
  FINANCE_ADMIN = 'FINANCE_ADMIN',
  SUPPORT_ADMIN = 'SUPPORT_ADMIN',
}

export enum FlPaymentStatus {
  SUCCESS = 'successful',
  FAILED = 'failed',
  IGNORED = 'ignored',
  PAYMENT_NOT_FOUND = 'payment not found',
  ALREADY_PROCESSED = 'already processed',
}

export enum PaymentType {
  CARD = 'card',
  TRANSFER = 'transfer',
  USSD = 'ussd',
}

export enum BillingSource {
  CARD = 'CARD',
  TRANSFER = 'TRANSFER',
  USSD = 'USSD',
  ADMIN = 'ADMIN',
  PROMO = 'PROMO',
}

export enum FlPaymentPlanInterval {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}
