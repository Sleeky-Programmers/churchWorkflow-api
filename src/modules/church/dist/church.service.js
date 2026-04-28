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
exports.ChurchService = void 0;
var common_1 = require("@nestjs/common");
var mongoose_1 = require("@nestjs/mongoose");
var church_schema_1 = require("../../schemas/church.schema");
var pagination_helper_1 = require("../../common/helpers/pagination.helper");
var admin_service_1 = require("../admin/admin.service");
var enums_utils_1 = require("../../common/utils/enums.utils");
var ChurchService = /** @class */ (function () {
    function ChurchService(churchModel, fileUploadService, adminService, subscriptionService, membersService) {
        this.churchModel = churchModel;
        this.fileUploadService = fileUploadService;
        this.adminService = adminService;
        this.subscriptionService = subscriptionService;
        this.membersService = membersService;
    }
    ChurchService.prototype.findById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.churchModel.findById(id)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ChurchService.prototype.findAll = function (paginationBaseDto) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, _b, page, _c, limit, search, skip, query, plan, churchIds, totalCountEmpty, _d, churches, itemCount, now, data, totalCount;
            var _this = this;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        _a = paginationBaseDto, _b = _a.page, page = _b === void 0 ? 1 : _b, _c = _a.limit, limit = _c === void 0 ? 20 : _c, search = _a.search;
                        skip = (page - 1) * limit;
                        query = {};
                        if (search) {
                            query.$or = [
                                { name: { $regex: search, $options: 'i' } },
                                { address: { $regex: search, $options: 'i' } },
                            ];
                        }
                        plan = paginationBaseDto.plan;
                        if (!plan) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.subscriptionService.getChurchIdsByPlan(plan)];
                    case 1:
                        churchIds = _e.sent();
                        if (!(!churchIds || churchIds.length === 0)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.churchModel.countDocuments()];
                    case 2:
                        totalCountEmpty = _e.sent();
                        return [2 /*return*/, {
                                data: [],
                                pagination: pagination_helper_1.paginationMeta({ page: page, limit: limit, itemCount: 0 }),
                                totalCount: totalCountEmpty
                            }];
                    case 3:
                        query._id = { $in: churchIds };
                        _e.label = 4;
                    case 4: return [4 /*yield*/, Promise.all([
                            this.churchModel
                                .find(query)
                                .sort({ createdAt: -1 })
                                .skip(skip)
                                .limit(limit)
                                .lean(),
                            this.churchModel.countDocuments(query),
                        ])];
                    case 5:
                        _d = _e.sent(), churches = _d[0], itemCount = _d[1];
                        now = new Date();
                        return [4 /*yield*/, Promise.all(churches.map(function (church) { return __awaiter(_this, void 0, void 0, function () {
                                var totalMembers, totalUsers, subscription, subscriptionStatus, end;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0: return [4 /*yield*/, this.membersService.countMembersByChurch(church._id)];
                                        case 1:
                                            totalMembers = _a.sent();
                                            return [4 /*yield*/, this.adminService.countAdminsByChurch(church._id)];
                                        case 2:
                                            totalUsers = _a.sent();
                                            return [4 /*yield*/, this.subscriptionService.getSubscription(church._id)];
                                        case 3:
                                            subscription = _a.sent();
                                            subscriptionStatus = enums_utils_1.ChurchSubscriptionStatus.ACTIVE;
                                            if (subscription && subscription.endDate) {
                                                end = new Date(subscription.endDate);
                                                if (end < now) {
                                                    subscriptionStatus = enums_utils_1.ChurchSubscriptionStatus.OVERDUE;
                                                }
                                                else if (end.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000) {
                                                    subscriptionStatus = enums_utils_1.ChurchSubscriptionStatus.EXPIRING_SOON;
                                                }
                                                else {
                                                    subscriptionStatus = enums_utils_1.ChurchSubscriptionStatus.ACTIVE;
                                                }
                                            }
                                            else {
                                                subscriptionStatus = subscription
                                                    ? enums_utils_1.ChurchSubscriptionStatus.ACTIVE
                                                    : enums_utils_1.ChurchSubscriptionStatus.OVERDUE;
                                            }
                                            return [2 /*return*/, {
                                                    id: church._id,
                                                    name: church.name,
                                                    location: church.address ||
                                                        ((church.state || '') + " " + (church.country || '')).trim(),
                                                    totalMembers: totalMembers,
                                                    totalUsers: totalUsers,
                                                    plan: (subscription === null || subscription === void 0 ? void 0 : subscription.plan) || null,
                                                    subscriptionStatus: subscriptionStatus
                                                }];
                                    }
                                });
                            }); }))];
                    case 6:
                        data = _e.sent();
                        return [4 /*yield*/, this.churchModel.countDocuments()];
                    case 7:
                        totalCount = _e.sent();
                        return [2 /*return*/, {
                                data: data,
                                pagination: pagination_helper_1.paginationMeta({ page: page, limit: limit, itemCount: itemCount }),
                                totalCount: totalCount
                            }];
                }
            });
        });
    };
    ChurchService.prototype.countAllChurches = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.churchModel.countDocuments()];
            });
        });
    };
    ChurchService.prototype.findDetailsById = function (id) {
        return __awaiter(this, void 0, Promise, function () {
            var church, totalMembers, totalUsers, subscription, superAdmin;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.churchModel.findById(id).lean()];
                    case 1:
                        church = _a.sent();
                        if (!church) {
                            throw new Error('Church not found');
                        }
                        return [4 /*yield*/, this.membersService.countMembersByChurch(church._id)];
                    case 2:
                        totalMembers = _a.sent();
                        return [4 /*yield*/, this.adminService.countAdminsByChurch(church._id)];
                    case 3:
                        totalUsers = _a.sent();
                        return [4 /*yield*/, this.subscriptionService.getSubscription(church._id)];
                    case 4:
                        subscription = _a.sent();
                        return [4 /*yield*/, this.adminService.findFirstSuperAdminByChurch(church._id)];
                    case 5:
                        superAdmin = _a.sent();
                        return [2 /*return*/, __assign(__assign({}, church), { totalMembers: totalMembers,
                                totalUsers: totalUsers,
                                subscription: subscription,
                                superAdmin: superAdmin })];
                }
            });
        });
    };
    ChurchService.prototype.findCurrentChurch = function (authUser) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!authUser.churchId) {
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, this.churchModel.findById(authUser.churchId)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ChurchService.prototype.create = function (authUser, churchIdentityDto, file) {
        return __awaiter(this, void 0, void 0, function () {
            var url, publicId, _a, fileUrl, filePublicId, church, subscription;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!file) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.fileUploadService.uploadFile(file)];
                    case 1:
                        _a = _b.sent(), fileUrl = _a.url, filePublicId = _a.publicId;
                        url = fileUrl;
                        publicId = filePublicId;
                        _b.label = 2;
                    case 2: return [4 /*yield*/, this.churchModel.create(__assign(__assign({}, churchIdentityDto), { logoUrl: url, logoPublicId: publicId }))];
                    case 3:
                        church = _b.sent();
                        return [4 /*yield*/, this.adminService.findByIdAndUpdate(authUser._id, {
                                churchId: church._id
                            })];
                    case 4:
                        _b.sent();
                        return [4 /*yield*/, this.subscriptionService.getSubscription(church._id)];
                    case 5:
                        subscription = _b.sent();
                        if (!!subscription) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.subscriptionService.createTrialSubscription(church._id)];
                    case 6:
                        _b.sent();
                        _b.label = 7;
                    case 7: return [2 /*return*/, church];
                }
            });
        });
    };
    ChurchService.prototype.getChurchStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, thirtyDaysAgo, _a, totalChurches, newChurchesLast30Days;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        now = new Date();
                        thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        thirtyDaysAgo.setHours(0, 0, 0, 0);
                        return [4 /*yield*/, Promise.all([
                                this.churchModel.countDocuments().exec(),
                                this.churchModel.countDocuments({
                                    createdAt: { $gte: thirtyDaysAgo }
                                }).exec(),
                            ])];
                    case 1:
                        _a = _b.sent(), totalChurches = _a[0], newChurchesLast30Days = _a[1];
                        return [2 /*return*/, {
                                totalChurches: totalChurches,
                                newChurchesLast30Days: newChurchesLast30Days
                            }];
                }
            });
        });
    };
    ChurchService.prototype.update = function (churchId, data, file) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, url, publicId;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!file) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.fileUploadService.uploadFile(file)];
                    case 1:
                        _a = _b.sent(), url = _a.url, publicId = _a.publicId;
                        data.logoUrl = url;
                        data.logoPublicId = publicId;
                        _b.label = 2;
                    case 2: return [4 /*yield*/, this.churchModel.findByIdAndUpdate(churchId, data, {
                            "new": true
                        })];
                    case 3: return [2 /*return*/, _b.sent()];
                }
            });
        });
    };
    ChurchService = __decorate([
        common_1.Injectable(),
        __param(0, mongoose_1.InjectModel(church_schema_1.Church.name)),
        __param(2, common_1.Inject(common_1.forwardRef(function () { return admin_service_1.AdminService; })))
    ], ChurchService);
    return ChurchService;
}());
exports.ChurchService = ChurchService;
