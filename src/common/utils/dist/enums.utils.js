"use strict";
exports.__esModule = true;
exports.PaymentTimeframe = exports.PaymentProvider = exports.DiscountType = exports.MemberLimitType = exports.ChurchSubscriptionStatus = exports.SubscriptionStatus = exports.PlanType = exports.PaymentStatus = exports.BillingCycle = exports.SmallTeamStatus = exports.AttendanceStatus = exports.CouponFilter = exports.MemberFilter = exports.AccountDeletionStatus = exports.MemberTitle = exports.NotificationType = exports.ModuleSections = exports.AccessLevel = exports.RoleType = exports.DepartmentMemberAction = exports.DepartmentStatus = exports.RoleStatus = exports.AdminOptions = exports.InviteEmailType = exports.AdminInviteStatus = exports.MembershipStatus = exports.MaritalStatus = exports.Gender = exports.ServiceType = exports.ServiceDay = exports.ChurchRole = void 0;
var ChurchRole;
(function (ChurchRole) {
    ChurchRole["GENERAL_OVERSEER"] = "GENERAL_OVERSEER";
    ChurchRole["SENIOR_PASTOR"] = "SENIOR_PASTOR";
    ChurchRole["PASTOR"] = "PASTOR";
    ChurchRole["CHURCH_ADMINISTRATOR"] = "CHURCH_ADMINISTRATOR";
    ChurchRole["CELL_LEADER"] = "CELL_LEADER";
    ChurchRole["FELLOWSHIP_GROUP_LEADER"] = "FELLOWSHIP_GROUP_LEADER";
})(ChurchRole = exports.ChurchRole || (exports.ChurchRole = {}));
var ServiceDay;
(function (ServiceDay) {
    ServiceDay["SUNDAY"] = "SUNDAY";
    ServiceDay["MONDAY"] = "MONDAY";
    ServiceDay["TUESDAY"] = "TUESDAY";
    ServiceDay["WEDNESDAY"] = "WEDNESDAY";
    ServiceDay["THURSDAY"] = "THURSDAY";
    ServiceDay["FRIDAY"] = "FRIDAY";
    ServiceDay["SATURDAY"] = "SATURDAY";
})(ServiceDay = exports.ServiceDay || (exports.ServiceDay = {}));
var ServiceType;
(function (ServiceType) {
    ServiceType["REGULAR"] = "REGULAR";
    ServiceType["SPECIAL"] = "SPECIAL";
})(ServiceType = exports.ServiceType || (exports.ServiceType = {}));
var Gender;
(function (Gender) {
    Gender["MALE"] = "MALE";
    Gender["FEMALE"] = "FEMALE";
})(Gender = exports.Gender || (exports.Gender = {}));
var MaritalStatus;
(function (MaritalStatus) {
    MaritalStatus["MARRIED"] = "MARRIED";
    MaritalStatus["SINGLE"] = "SINGLE";
    MaritalStatus["DIVORCED"] = "DIVORCED";
    MaritalStatus["WIDOWED"] = "WIDOWED";
})(MaritalStatus = exports.MaritalStatus || (exports.MaritalStatus = {}));
var MembershipStatus;
(function (MembershipStatus) {
    MembershipStatus["VISITOR"] = "VISITOR";
    MembershipStatus["MEMBER"] = "MEMBER";
    MembershipStatus["VOLUNTEER"] = "VOLUNTEER";
    MembershipStatus["WORKER"] = "WORKER";
    MembershipStatus["LEADER"] = "LEADER";
    MembershipStatus["CONVERT"] = "NEW CONVERT";
})(MembershipStatus = exports.MembershipStatus || (exports.MembershipStatus = {}));
var AdminInviteStatus;
(function (AdminInviteStatus) {
    AdminInviteStatus["PENDING"] = "PENDING";
    AdminInviteStatus["DECLINED"] = "DECLINED";
    AdminInviteStatus["ACTIVE"] = "ACTIVE";
    AdminInviteStatus["SUSPENDED"] = "SUSPENDED";
})(AdminInviteStatus = exports.AdminInviteStatus || (exports.AdminInviteStatus = {}));
var InviteEmailType;
(function (InviteEmailType) {
    InviteEmailType["INVITE"] = "INVITE";
    InviteEmailType["ROLE_CHANGE"] = "ROLE_CHANGE";
})(InviteEmailType = exports.InviteEmailType || (exports.InviteEmailType = {}));
var AdminOptions;
(function (AdminOptions) {
    AdminOptions["SUSPEND"] = "SUSPEND";
    AdminOptions["RESTORE"] = "RESTORE";
})(AdminOptions = exports.AdminOptions || (exports.AdminOptions = {}));
var RoleStatus;
(function (RoleStatus) {
    RoleStatus["ACTIVE"] = "ACTIVE";
    RoleStatus["DISABLED"] = "DISABLED";
})(RoleStatus = exports.RoleStatus || (exports.RoleStatus = {}));
var DepartmentStatus;
(function (DepartmentStatus) {
    DepartmentStatus["ACTIVE"] = "ACTIVE";
    DepartmentStatus["INACTIVE"] = "INACTIVE";
})(DepartmentStatus = exports.DepartmentStatus || (exports.DepartmentStatus = {}));
var DepartmentMemberAction;
(function (DepartmentMemberAction) {
    DepartmentMemberAction["ADD"] = "ADD";
    DepartmentMemberAction["REMOVE"] = "REMOVE";
})(DepartmentMemberAction = exports.DepartmentMemberAction || (exports.DepartmentMemberAction = {}));
var RoleType;
(function (RoleType) {
    RoleType["SYSTEM"] = "SYSTEM";
    RoleType["CUSTOM"] = "CUSTOM";
})(RoleType = exports.RoleType || (exports.RoleType = {}));
var AccessLevel;
(function (AccessLevel) {
    AccessLevel["NO_ACCESS"] = "NO_ACCESS";
    AccessLevel["VIEW"] = "VIEW";
    AccessLevel["MANAGE"] = "MANAGE";
    AccessLevel["FULL_ACCESS"] = "FULL_ACCESS";
})(AccessLevel = exports.AccessLevel || (exports.AccessLevel = {}));
var ModuleSections;
(function (ModuleSections) {
    ModuleSections["MEMBERS"] = "MEMBERS";
    ModuleSections["GIVING"] = "GIVING";
    ModuleSections["GIVING_AND_EXPENSES"] = "GIVING_AND_EXPENSES";
    ModuleSections["REQUESTS"] = "REQUESTS";
    ModuleSections["EVENTS"] = "EVENTS";
    ModuleSections["DEPARTMENTS"] = "DEPARTMENTS";
    ModuleSections["ATTENDANCE"] = "ATTENDANCE";
    ModuleSections["SUBSCRIPTION"] = "SUBSCRIPTION";
    ModuleSections["PAYMENT"] = "PAYMENT";
    ModuleSections["CHURCH"] = "CHURCH";
    ModuleSections["ADMIN"] = "ADMIN";
})(ModuleSections = exports.ModuleSections || (exports.ModuleSections = {}));
var NotificationType;
(function (NotificationType) {
    NotificationType["REQUISITION"] = "REQUISITION";
    NotificationType["MESSAGE"] = "MESSAGE";
    NotificationType["ROLE_UPDATE"] = "ROLE_UPDATE";
    NotificationType["BIRTHDAY"] = "BIRTHDAY";
    NotificationType["SUBSCRIPTION"] = "SUBSCRIPTION";
    NotificationType["MEMBER"] = "MEMBER";
    NotificationType["FINANCE"] = "FINANCE";
})(NotificationType = exports.NotificationType || (exports.NotificationType = {}));
var MemberTitle;
(function (MemberTitle) {
    MemberTitle["NONE"] = "NONE";
    MemberTitle["MR"] = "MR.";
    MemberTitle["MRS"] = "MRS.";
    MemberTitle["MISS"] = "MISS";
    MemberTitle["DR"] = "DR.";
    MemberTitle["PASTOR"] = "PASTOR";
    MemberTitle["REV"] = "REV.";
})(MemberTitle = exports.MemberTitle || (exports.MemberTitle = {}));
var AccountDeletionStatus;
(function (AccountDeletionStatus) {
    AccountDeletionStatus["PENDING"] = "PENDING";
    AccountDeletionStatus["COMPLETED"] = "COMPLETED";
    AccountDeletionStatus["FAILED"] = "FAILED";
})(AccountDeletionStatus = exports.AccountDeletionStatus || (exports.AccountDeletionStatus = {}));
var MemberFilter;
(function (MemberFilter) {
    MemberFilter["ALL"] = "all";
    MemberFilter["MALE"] = "male";
    MemberFilter["FEMALE"] = "female";
    MemberFilter["MARRIED"] = "married";
    MemberFilter["SINGLE"] = "single";
    MemberFilter["DIVORCED"] = "divorced";
    MemberFilter["WIDOWED"] = "widowed";
    MemberFilter["VISITOR"] = "visitor";
    MemberFilter["MEMBER"] = "member";
    MemberFilter["WORKER"] = "worker";
    MemberFilter["VOLUNTEER"] = "volunteer";
    MemberFilter["LEADER"] = "leader";
    MemberFilter["CONVERT"] = "new-convert";
    MemberFilter["NEW_MEMBERS"] = "new-members";
    MemberFilter["IS_BAPTIZED"] = "is-baptized";
})(MemberFilter = exports.MemberFilter || (exports.MemberFilter = {}));
var CouponFilter;
(function (CouponFilter) {
    CouponFilter["ACTIVE"] = "active";
    CouponFilter["INACTIVE"] = "inactive";
    CouponFilter["EXPIRED"] = "expired";
})(CouponFilter = exports.CouponFilter || (exports.CouponFilter = {}));
var AttendanceStatus;
(function (AttendanceStatus) {
    AttendanceStatus["PRESENT"] = "PRESENT";
    AttendanceStatus["ABSENT"] = "ABSENT";
})(AttendanceStatus = exports.AttendanceStatus || (exports.AttendanceStatus = {}));
var SmallTeamStatus;
(function (SmallTeamStatus) {
    SmallTeamStatus["ACTIVE"] = "ACTIVE";
    SmallTeamStatus["INACTIVE"] = "INACTIVE";
})(SmallTeamStatus = exports.SmallTeamStatus || (exports.SmallTeamStatus = {}));
var BillingCycle;
(function (BillingCycle) {
    BillingCycle["MONTHLY"] = "MONTHLY";
    BillingCycle["YEARLY"] = "YEARLY";
})(BillingCycle = exports.BillingCycle || (exports.BillingCycle = {}));
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "PENDING";
    PaymentStatus["SUCCESS"] = "SUCCESS";
    PaymentStatus["FAILED"] = "FAILED";
    PaymentStatus["REFUNDED"] = "REFUNDED";
})(PaymentStatus = exports.PaymentStatus || (exports.PaymentStatus = {}));
var PlanType;
(function (PlanType) {
    PlanType["STARTER"] = "STARTER";
    PlanType["GROWTH"] = "GROWTH";
    PlanType["EXPANSION"] = "EXPANSION";
    PlanType["ENTERPRISE"] = "ENTERPRISE";
})(PlanType = exports.PlanType || (exports.PlanType = {}));
var SubscriptionStatus;
(function (SubscriptionStatus) {
    SubscriptionStatus["ACTIVE"] = "ACTIVE";
    SubscriptionStatus["GRACE"] = "GRACE";
    SubscriptionStatus["EXPIRED"] = "EXPIRED";
    SubscriptionStatus["TRIAL"] = "TRIAL";
})(SubscriptionStatus = exports.SubscriptionStatus || (exports.SubscriptionStatus = {}));
var ChurchSubscriptionStatus;
(function (ChurchSubscriptionStatus) {
    ChurchSubscriptionStatus["ACTIVE"] = "Active";
    ChurchSubscriptionStatus["OVERDUE"] = "Overdue";
    ChurchSubscriptionStatus["EXPIRING_SOON"] = "Expiring soon";
})(ChurchSubscriptionStatus = exports.ChurchSubscriptionStatus || (exports.ChurchSubscriptionStatus = {}));
var MemberLimitType;
(function (MemberLimitType) {
    MemberLimitType["NONE"] = "NONE";
    MemberLimitType["BLOCK"] = "BLOCK";
    MemberLimitType["WARNING"] = "WARNING";
})(MemberLimitType = exports.MemberLimitType || (exports.MemberLimitType = {}));
var DiscountType;
(function (DiscountType) {
    DiscountType["PERCENTAGE"] = "PERCENTAGE";
    DiscountType["FLAT"] = "FLAT";
})(DiscountType = exports.DiscountType || (exports.DiscountType = {}));
var PaymentProvider;
(function (PaymentProvider) {
    PaymentProvider["PAYSTACK"] = "paystack";
    PaymentProvider["FLUTTERWAVE"] = "flutterwave";
})(PaymentProvider = exports.PaymentProvider || (exports.PaymentProvider = {}));
var PaymentTimeframe;
(function (PaymentTimeframe) {
    PaymentTimeframe["WEEK"] = "week";
    PaymentTimeframe["MONTH"] = "month";
    PaymentTimeframe["QUARTER"] = "quarter";
})(PaymentTimeframe = exports.PaymentTimeframe || (exports.PaymentTimeframe = {}));
