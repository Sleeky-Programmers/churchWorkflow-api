"use strict";
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
exports.CouponService = void 0;
var common_1 = require("@nestjs/common");
var mongoose_1 = require("@nestjs/mongoose");
var coupon_schema_1 = require("../../schemas/coupon.schema");
var enums_utils_1 = require("src/common/utils/enums.utils");
var pagination_helper_1 = require("../../common/helpers/pagination.helper");
var CouponService = /** @class */ (function () {
    function CouponService(couponModel) {
        this.couponModel = couponModel;
    }
    CouponService.prototype.create = function (createDto) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var exists, toCreate, created;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.couponModel
                            .findOne({ code: createDto.code })
                            .lean()];
                    case 1:
                        exists = _b.sent();
                        if (exists) {
                            throw new common_1.BadRequestException('Coupon code already exists');
                        }
                        toCreate = {
                            code: createDto.code,
                            description: createDto.description,
                            discountType: createDto.discountType,
                            discount: createDto.discount,
                            maxUsage: (_a = createDto.maxUsage) !== null && _a !== void 0 ? _a : 0,
                            isActive: typeof createDto.isActive === 'boolean' ? createDto.isActive : true
                        };
                        if (createDto.expiryDate) {
                            toCreate.expiryDate = new Date(createDto.expiryDate);
                        }
                        return [4 /*yield*/, this.couponModel.create(toCreate)];
                    case 2:
                        created = _b.sent();
                        return [2 /*return*/, created.toObject()];
                }
            });
        });
    };
    CouponService.prototype.findAll = function (paginationBaseDto) {
        return __awaiter(this, void 0, void 0, function () {
            var page, limit, search, filter, skip, query, now, _a, coupons, itemCount, data;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        page = paginationBaseDto.page, limit = paginationBaseDto.limit, search = paginationBaseDto.search, filter = paginationBaseDto.filter;
                        skip = (page - 1) * limit;
                        query = {};
                        if (search) {
                            query.$or = [
                                { code: { $regex: search, $options: 'i' } },
                                { description: { $regex: search, $options: 'i' } },
                            ];
                        }
                        now = new Date();
                        switch (filter) {
                            case enums_utils_1.CouponFilter.ACTIVE:
                                query.isActive = true;
                                query.$or = [
                                    { expiryDate: { $exists: false } },
                                    { expiryDate: { $gte: now } },
                                ];
                                break;
                            case enums_utils_1.CouponFilter.INACTIVE:
                                query.isActive = false;
                                break;
                            case enums_utils_1.CouponFilter.EXPIRED:
                                query.expiryDate = { $lt: now };
                                break;
                        }
                        return [4 /*yield*/, Promise.all([
                                this.couponModel.find(query).skip(skip).limit(limit),
                                this.couponModel.countDocuments(query),
                            ])];
                    case 1:
                        _a = _b.sent(), coupons = _a[0], itemCount = _a[1];
                        data = coupons.map(function (coupon) {
                            var _a;
                            return ({
                                id: coupon._id,
                                code: coupon.code,
                                description: coupon.description,
                                discountType: coupon.discountType,
                                discount: coupon.discount,
                                maxUsage: coupon.maxUsage,
                                expiryDate: coupon.expiryDate,
                                isActive: coupon.isActive,
                                usageCount: (_a = coupon.usageCount) !== null && _a !== void 0 ? _a : 0,
                                createdAt: coupon.createdAt,
                                updatedAt: coupon.updatedAt
                            });
                        });
                        return [2 /*return*/, {
                                data: data,
                                pagination: pagination_helper_1.paginationMeta({ page: page, limit: limit, itemCount: itemCount })
                            }];
                }
            });
        });
    };
    CouponService.prototype.stats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var now, soon, _a, totalCoupons, activeCoupons, expiringSoonAgg, totalUsageAgg, totalUsage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        now = new Date();
                        soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                        return [4 /*yield*/, Promise.all([
                                this.couponModel.countDocuments(),
                                this.couponModel.countDocuments({ isActive: true }),
                                this.couponModel.countDocuments({
                                    expiryDate: { $gte: now, $lte: soon }
                                }),
                                this.couponModel.aggregate([
                                    { $group: { _id: null, total: { $sum: '$usageCount' } } },
                                ]),
                            ])];
                    case 1:
                        _a = _b.sent(), totalCoupons = _a[0], activeCoupons = _a[1], expiringSoonAgg = _a[2], totalUsageAgg = _a[3];
                        totalUsage = (totalUsageAgg && totalUsageAgg[0] && totalUsageAgg[0].total) || 0;
                        return [2 /*return*/, {
                                totalCoupons: totalCoupons,
                                activeCoupons: activeCoupons,
                                expiringSoon: expiringSoonAgg,
                                totalUsage: totalUsage
                            }];
                }
            });
        });
    };
    CouponService.prototype.validateCoupon = function (code) {
        var _a;
        return __awaiter(this, void 0, void 0, function () {
            var coupon, usage;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!code) {
                            throw new common_1.BadRequestException('Coupon code is required');
                        }
                        return [4 /*yield*/, this.couponModel.findOne({ code: code }).lean()];
                    case 1:
                        coupon = _b.sent();
                        if (!coupon || !coupon.isActive) {
                            throw new common_1.BadRequestException('Invalid coupon code');
                        }
                        if (coupon.expiryDate && new Date(coupon.expiryDate) < new Date()) {
                            throw new common_1.BadRequestException('Coupon has expired');
                        }
                        usage = (_a = coupon.usageCount) !== null && _a !== void 0 ? _a : 0;
                        if (coupon.maxUsage && coupon.maxUsage > 0 && usage >= coupon.maxUsage) {
                            throw new common_1.BadRequestException('Coupon usage limit reached');
                        }
                        return [2 /*return*/, coupon];
                }
            });
        });
    };
    CouponService.prototype.incrementUsage = function (code) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!code) {
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, this.couponModel.findOneAndUpdate({ code: code }, { $inc: { usageCount: 1 } }, { "new": true })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    CouponService.prototype.update = function (id, updateDto) {
        return __awaiter(this, void 0, void 0, function () {
            var coupon, exists;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.couponModel.findById(id)];
                    case 1:
                        coupon = _a.sent();
                        if (!coupon) {
                            throw new common_1.BadRequestException('Coupon not found');
                        }
                        if (!(updateDto.code && updateDto.code !== coupon.code)) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.couponModel
                                .findOne({ code: updateDto.code })
                                .lean()];
                    case 2:
                        exists = _a.sent();
                        if (exists) {
                            throw new common_1.BadRequestException('Coupon code already exists');
                        }
                        _a.label = 3;
                    case 3:
                        if (updateDto.code !== undefined) {
                            coupon.code = updateDto.code;
                        }
                        if (updateDto.description !== undefined) {
                            coupon.description = updateDto.description;
                        }
                        if (updateDto.discountType !== undefined) {
                            coupon.discountType = updateDto.discountType;
                        }
                        if (updateDto.discount !== undefined) {
                            coupon.discount = updateDto.discount;
                        }
                        if (updateDto.maxUsage !== undefined) {
                            coupon.maxUsage = updateDto.maxUsage;
                        }
                        if (updateDto.isActive !== undefined) {
                            coupon.isActive = updateDto.isActive;
                        }
                        if (updateDto.expiryDate) {
                            coupon.expiryDate = new Date(updateDto.expiryDate);
                        }
                        return [4 /*yield*/, coupon.save()];
                    case 4:
                        _a.sent();
                        return [2 /*return*/, coupon.toObject()];
                }
            });
        });
    };
    CouponService.prototype.remove = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var deleted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.couponModel.findByIdAndDelete(id)];
                    case 1:
                        deleted = _a.sent();
                        if (!deleted) {
                            throw new common_1.BadRequestException('Coupon not found');
                        }
                        return [2 /*return*/, {
                                message: 'Coupon deleted successfully'
                            }];
                }
            });
        });
    };
    CouponService = __decorate([
        common_1.Injectable(),
        __param(0, mongoose_1.InjectModel(coupon_schema_1.Coupon.name))
    ], CouponService);
    return CouponService;
}());
exports.CouponService = CouponService;
