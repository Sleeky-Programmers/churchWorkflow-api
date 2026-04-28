"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.SubscriptionService = void 0;
var common_1 = require("@nestjs/common");
var mongoose_1 = require("@nestjs/mongoose");
var mongoose_2 = require("mongoose");
var subscription_schema_1 = require("../../schemas/subscription.schema");
var enums_utils_1 = require("../../common/utils/enums.utils");
var SubscriptionService = /** @class */ (function () {
    function SubscriptionService(subscriptionModel, paymentService) {
        var _a;
        this.subscriptionModel = subscriptionModel;
        this.paymentService = paymentService;
        this.planLimits = (_a = {},
            _a[enums_utils_1.PlanType.STARTER] = {
                members: 100,
                users: 3,
                customRoles: false
            },
            _a[enums_utils_1.PlanType.GROWTH] = {
                members: 500,
                users: 10,
                customRoles: true
            },
            _a[enums_utils_1.PlanType.EXPANSION] = {
                members: 1500,
                users: 25,
                customRoles: true
            },
            _a[enums_utils_1.PlanType.ENTERPRISE] = {
                members: -1,
                users: -1,
                customRoles: true
            },
            _a);
    }
    SubscriptionService.prototype.getPlanAmount = function (plan, billingCycle) {
        var _a, _b, _c, _d, _e;
        var _f;
        var pricing = (_a = {},
            _a[enums_utils_1.PlanType.STARTER] = (_b = {},
                _b[enums_utils_1.BillingCycle.MONTHLY] = 0,
                _b[enums_utils_1.BillingCycle.YEARLY] = 0,
                _b),
            _a[enums_utils_1.PlanType.GROWTH] = (_c = {},
                _c[enums_utils_1.BillingCycle.MONTHLY] = 20000,
                _c[enums_utils_1.BillingCycle.YEARLY] = 200000,
                _c),
            _a[enums_utils_1.PlanType.EXPANSION] = (_d = {},
                _d[enums_utils_1.BillingCycle.MONTHLY] = 45000,
                _d[enums_utils_1.BillingCycle.YEARLY] = 450000,
                _d),
            _a[enums_utils_1.PlanType.ENTERPRISE] = (_e = {},
                _e[enums_utils_1.BillingCycle.MONTHLY] = 100000,
                _e[enums_utils_1.BillingCycle.YEARLY] = 1000000,
                _e),
            _a);
        var planPricing = pricing[plan] || pricing[enums_utils_1.PlanType.STARTER];
        return (_f = planPricing[billingCycle]) !== null && _f !== void 0 ? _f : planPricing[enums_utils_1.BillingCycle.MONTHLY];
    };
    SubscriptionService.prototype.getSubscription = function (churchId) {
        return __awaiter(this, void 0, void 0, function () {
            var subscription;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.subscriptionModel.findOne({ churchId: churchId })];
                    case 1:
                        subscription = _a.sent();
                        if (!subscription) {
                            return [2 /*return*/, this.initializeTrialPlan(churchId)];
                        }
                        return [2 /*return*/, subscription];
                }
            });
        });
    };
    SubscriptionService.prototype.initializeTrialPlan = function (churchId) {
        return __awaiter(this, void 0, void 0, function () {
            var limits, trialEndDate;
            return __generator(this, function (_a) {
                limits = this.planLimits[enums_utils_1.PlanType.STARTER];
                trialEndDate = new Date();
                trialEndDate.setDate(trialEndDate.getDate() + 7);
                return [2 /*return*/, this.subscriptionModel.create({
                        churchId: churchId,
                        plan: enums_utils_1.PlanType.STARTER,
                        status: enums_utils_1.SubscriptionStatus.TRIAL,
                        memberLimit: limits.members,
                        userLimit: limits.users,
                        customRolesEnabled: limits.customRoles,
                        endDate: trialEndDate,
                        gracePeriodEndDate: trialEndDate
                    })];
            });
        });
    };
    SubscriptionService.prototype.createTrialSubscription = function (churchId) {
        return __awaiter(this, void 0, void 0, function () {
            var existing;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.subscriptionModel.findOne({ churchId: churchId })];
                    case 1:
                        existing = _a.sent();
                        if (existing) {
                            return [2 /*return*/, existing];
                        }
                        return [2 /*return*/, this.initializeTrialPlan(churchId)];
                }
            });
        });
    };
    SubscriptionService.prototype.updateSubscription = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var limits, startDate, endDate;
            return __generator(this, function (_a) {
                limits = this.planLimits[data.plan];
                startDate = new Date();
                endDate = new Date();
                if (data.billingCycle === enums_utils_1.BillingCycle.MONTHLY) {
                    endDate.setMonth(endDate.getMonth() + 1);
                }
                else {
                    endDate.setFullYear(endDate.getFullYear() + 1);
                }
                return [2 /*return*/, this.subscriptionModel.findOneAndUpdate({ churchId: new mongoose_2.Types.ObjectId(data.churchId) }, __assign({ plan: data.plan, status: enums_utils_1.SubscriptionStatus.ACTIVE, memberLimit: limits.members, userLimit: limits.users, customRolesEnabled: limits.customRoles, startDate: startDate,
                        endDate: endDate, isAutoRenew: data.autoRenew, gracePeriodEndDate: null }, (data.providerData && {
                        provider: {
                            name: enums_utils_1.PaymentProvider.PAYSTACK,
                            subscriptionCode: data.providerData.subscriptionCode,
                            emailToken: data.providerData.emailToken,
                            customerCode: data.providerData.customerCode
                        }
                    })), { "new": true, upsert: true })];
            });
        });
    };
    SubscriptionService.prototype.isActiveAutoRenewing = function (churchId) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var subscription;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.getSubscription(churchId)];
                    case 1:
                        subscription = _b.sent();
                        return [2 /*return*/, ((subscription === null || subscription === void 0 ? void 0 : subscription.isAutoRenew) && ((_a = subscription === null || subscription === void 0 ? void 0 : subscription.provider) === null || _a === void 0 ? void 0 : _a.subscriptionCode) &&
                                (subscription === null || subscription === void 0 ? void 0 : subscription.status) === enums_utils_1.SubscriptionStatus.ACTIVE)];
                }
            });
        });
    };
    SubscriptionService.prototype.checkMemberLimit = function (churchId, currentMemberCount) {
        return __awaiter(this, void 0, void 0, function () {
            var sub;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getSubscription(churchId)];
                    case 1:
                        sub = _a.sent();
                        if (sub.memberLimit === -1) {
                            return [2 /*return*/, { allowed: true, type: enums_utils_1.MemberLimitType.NONE }];
                        }
                        if (currentMemberCount >= sub.memberLimit) {
                            return [2 /*return*/, {
                                    allowed: false,
                                    message: "You've reached your " + sub.memberLimit + " member limit. Upgrade to continue.",
                                    type: enums_utils_1.MemberLimitType.BLOCK
                                }];
                        }
                        if (currentMemberCount >= 0.8 * sub.memberLimit) {
                            return [2 /*return*/, {
                                    allowed: true,
                                    message: "You're close to your member limit (" + currentMemberCount + "/" + sub.memberLimit + ").",
                                    type: enums_utils_1.MemberLimitType.WARNING
                                }];
                        }
                        return [2 /*return*/, { allowed: true, type: enums_utils_1.MemberLimitType.NONE }];
                }
            });
        });
    };
    SubscriptionService.prototype.checkUserLimit = function (churchId, currentUserCount) {
        return __awaiter(this, void 0, void 0, function () {
            var sub;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getSubscription(churchId)];
                    case 1:
                        sub = _a.sent();
                        if (sub.userLimit === -1) {
                            return [2 /*return*/, { allowed: true }];
                        }
                        if (currentUserCount >= sub.userLimit) {
                            return [2 /*return*/, {
                                    allowed: false,
                                    message: "You've reached your " + sub.userLimit + " user limit. Upgrade to add more users."
                                }];
                        }
                        return [2 /*return*/, { allowed: true }];
                }
            });
        });
    };
    SubscriptionService.prototype.canUseCustomRoles = function (churchId) {
        return __awaiter(this, void 0, void 0, function () {
            var sub;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getSubscription(churchId)];
                    case 1:
                        sub = _a.sent();
                        return [2 /*return*/, sub.customRolesEnabled];
                }
            });
        });
    };
    SubscriptionService.prototype.getPaymentHistory = function (churchId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.paymentService.getChurchPayments(churchId)];
            });
        });
    };
    SubscriptionService.prototype.getChurchIdsByPlan = function (plan) {
        return __awaiter(this, void 0, void 0, function () {
            var subs;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.subscriptionModel
                            .find({ plan: plan })
                            .select('churchId')
                            .lean()];
                    case 1:
                        subs = _a.sent();
                        return [2 /*return*/, subs.map(function (s) { return s.churchId; })];
                }
            });
        });
    };
    SubscriptionService.prototype.getBillingOverview = function (churchId) {
        return __awaiter(this, void 0, void 0, function () {
            var subscription;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getSubscription(churchId)];
                    case 1:
                        subscription = _a.sent();
                        return [2 /*return*/, {
                                plans: this.getPlans(),
                                currentPlan: subscription.plan,
                                subscriptionStatus: subscription.status,
                                churchStatus: this.mapToChurchStatus(subscription),
                                billingCycle: this.getBillingCycle(subscription)
                            }];
                }
            });
        });
    };
    SubscriptionService.prototype.getSubscriptionByPlan = function () {
        return __awaiter(this, void 0, void 0, function () {
            var subscriptionsByPlan, churchesByPlan, totalStarterPlans, totalActivePlans;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.subscriptionModel.aggregate([
                            {
                                $group: {
                                    _id: '$plan',
                                    count: { $sum: 1 }
                                }
                            },
                        ])];
                    case 1:
                        subscriptionsByPlan = _a.sent();
                        churchesByPlan = {
                            STARTER: 0,
                            GROWTH: 0,
                            ENTERPRISE: 0
                        };
                        subscriptionsByPlan.forEach(function (item) {
                            churchesByPlan[item._id] = item.count;
                        });
                        totalStarterPlans = churchesByPlan.STARTER;
                        return [4 /*yield*/, this.subscriptionModel.countDocuments({
                                status: enums_utils_1.SubscriptionStatus.ACTIVE
                            })];
                    case 2:
                        totalActivePlans = _a.sent();
                        return [2 /*return*/, {
                                totalStarterPlans: totalStarterPlans,
                                totalActivePlans: totalActivePlans,
                                churchesByPlan: churchesByPlan
                            }];
                }
            });
        });
    };
    SubscriptionService.prototype.getPlans = function () {
        var _this = this;
        var numberOfMonths = 12;
        var yearlyDiscountRate = 0.83;
        return Object.values(enums_utils_1.PlanType).map(function (plan) { return ({
            type: plan,
            name: _this.formatPlanName(plan),
            monthlyPrice: _this.getPlanAmount(plan, enums_utils_1.BillingCycle.MONTHLY),
            yearlyPrice: Math.round(_this.getPlanAmount(plan, enums_utils_1.BillingCycle.MONTHLY) *
                numberOfMonths *
                yearlyDiscountRate),
            features: _this.getPlanFeatures(plan),
            popular: plan === enums_utils_1.PlanType.GROWTH
        }); });
    };
    SubscriptionService.prototype.getPlanFeatures = function (plan) {
        switch (plan) {
            case enums_utils_1.PlanType.STARTER:
                return [
                    'Small teams',
                    'Membership management',
                    'Up to 3 users',
                    'Up to 100 members',
                    'Attendance tracking',
                ];
            case enums_utils_1.PlanType.GROWTH:
                return [
                    'Everything in Starter',
                    'Up to 10 users',
                    'Up to 500 members',
                    'Custom roles & permissions',
                ];
            case enums_utils_1.PlanType.EXPANSION:
                return [
                    'Everything in Growth',
                    'Up to 25 users',
                    'Up to 1,500 members',
                ];
            case enums_utils_1.PlanType.ENTERPRISE:
                return [
                    'Everything in Expansion',
                    'Priority support',
                    'Unlimited users',
                    'Advanced controls',
                    'Unlimited members',
                ];
            default:
                return [];
        }
    };
    SubscriptionService.prototype.formatPlanName = function (plan) {
        return plan.charAt(0) + plan.slice(1).toLowerCase();
    };
    SubscriptionService.prototype.mapToChurchStatus = function (subscription) {
        if (subscription.status === enums_utils_1.SubscriptionStatus.TRIAL) {
            return enums_utils_1.SubscriptionStatus.TRIAL;
        }
        if (subscription.status === enums_utils_1.SubscriptionStatus.ACTIVE) {
            return enums_utils_1.SubscriptionStatus.ACTIVE;
        }
        if (subscription.endDate && new Date() > subscription.endDate) {
            return enums_utils_1.SubscriptionStatus.EXPIRED;
        }
        return enums_utils_1.SubscriptionStatus.ACTIVE;
    };
    SubscriptionService.prototype.getBillingCycle = function (subscription) {
        var oneDayInMilliseconds = 1000 * 60 * 60 * 24;
        var threeHundredSixtyFiveDaysLimit = 365;
        var subDurationInDays = (subscription.endDate.getTime() - subscription.startDate.getTime()) /
            oneDayInMilliseconds;
        if (subDurationInDays >= threeHundredSixtyFiveDaysLimit) {
            return enums_utils_1.BillingCycle.YEARLY;
        }
        return enums_utils_1.BillingCycle.MONTHLY;
    };
    SubscriptionService = __decorate([
        common_1.Injectable(),
        __param(0, mongoose_1.InjectModel(subscription_schema_1.Subscription.name))
    ], SubscriptionService);
    return SubscriptionService;
}());
exports.SubscriptionService = SubscriptionService;
