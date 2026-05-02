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
exports.PaymentController = void 0;
var common_1 = require("@nestjs/common");
var enums_utils_1 = require("../../common/utils/enums.utils");
var enums_utils_2 = require("../../common/utils/enums.utils");
var jwt_auth_guard_1 = require("../auth/guard/jwt-auth.guard");
var auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
var common_2 = require("@nestjs/common");
var product_jwt_auth_guard_1 = require("../product-admin/guard/product-jwt-auth.guard");
var PaymentController = /** @class */ (function () {
    function PaymentController(paymentService, paystackService, flutterwaveService, couponService, subscriptionService) {
        this.paymentService = paymentService;
        this.paystackService = paystackService;
        this.flutterwaveService = flutterwaveService;
        this.couponService = couponService;
        this.subscriptionService = subscriptionService;
    }
    PaymentController.prototype.initialize = function (authUser, body) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, promoCode, provider, existingSub, baseAmount, finalAmount, metadata, used, coupon, discountAmount, initPayload;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = body, promoCode = _a.promoCode, provider = _a.provider;
                        return [4 /*yield*/, this.subscriptionService.getSubscription(authUser.churchId)];
                    case 1:
                        existingSub = _b.sent();
                        if (existingSub &&
                            existingSub.plan !== enums_utils_1.PlanType.STARTER &&
                            existingSub.status === enums_utils_1.SubscriptionStatus.ACTIVE) {
                            throw new common_1.BadRequestException('Active paid subscription exists');
                        }
                        baseAmount = this.subscriptionService.getPlanAmount(body.plan, body.billingCycle);
                        finalAmount = baseAmount;
                        metadata = {};
                        if (!promoCode) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.paymentService.hasUsedCoupon(authUser.churchId, promoCode)];
                    case 2:
                        used = _b.sent();
                        if (used) {
                            throw new common_1.BadRequestException('Coupon already used by this account');
                        }
                        return [4 /*yield*/, this.couponService.validateCoupon(promoCode)];
                    case 3:
                        coupon = _b.sent();
                        discountAmount = 0;
                        if (coupon.discountType === enums_utils_1.DiscountType.PERCENTAGE) {
                            discountAmount = (baseAmount * coupon.discount) / 100;
                        }
                        else {
                            discountAmount = coupon.discount;
                        }
                        finalAmount = Math.max(0, baseAmount - discountAmount);
                        metadata.promoCode = coupon.code;
                        metadata.originalAmount = baseAmount;
                        metadata.discountAmount = discountAmount;
                        _b.label = 4;
                    case 4:
                        initPayload = {
                            email: authUser.email,
                            amount: finalAmount,
                            churchId: authUser.churchId,
                            plan: body.plan,
                            billingCycle: body.billingCycle,
                            metadata: metadata,
                            autoRenew: !!body.autoRenew
                        };
                        if (!(provider === enums_utils_1.PaymentProvider.PAYSTACK)) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.paystackService.initializeTransaction(initPayload)];
                    case 5: return [2 /*return*/, _b.sent()];
                    case 6:
                        if (!(provider === enums_utils_1.PaymentProvider.FLUTTERWAVE)) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.flutterwaveService.initializeTransaction(initPayload)];
                    case 7: return [2 /*return*/, _b.sent()];
                    case 8: throw new common_1.BadRequestException('Invalid payment provider');
                }
            });
        });
    };
    PaymentController.prototype.manualVerify = function (body) {
        var _a, _b, _c, _d, _e;
        return __awaiter(this, void 0, void 0, function () {
            var _f, reference, provider, paymentResult;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0:
                        _f = body, reference = _f.reference, provider = _f.provider;
                        if (!reference) {
                            throw new common_1.BadRequestException('Missing payment reference');
                        }
                        if (!(provider === enums_utils_1.PaymentProvider.PAYSTACK)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.paystackService.verifyTransaction(reference)];
                    case 1:
                        paymentResult = _g.sent();
                        return [3 /*break*/, 5];
                    case 2:
                        if (!(provider === enums_utils_1.PaymentProvider.FLUTTERWAVE)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.flutterwaveService.verifyTransaction(reference)];
                    case 3:
                        paymentResult =
                            _g.sent();
                        return [3 /*break*/, 5];
                    case 4: throw new common_1.BadRequestException('Invalid provider');
                    case 5:
                        if (!(paymentResult.status === 'success')) return [3 /*break*/, 8];
                        return [4 /*yield*/, this.paymentService.updatePaymentStatus(reference, enums_utils_2.PaymentStatus.SUCCESS, new Date())];
                    case 6:
                        _g.sent();
                        return [4 /*yield*/, this.subscriptionService.updateSubscription({
                                churchId: paymentResult.churchId,
                                plan: paymentResult.plan,
                                billingCycle: paymentResult.billingCycle,
                                autoRenew: paymentResult.autoRenew,
                                providerData: {
                                    subscriptionCode: paymentResult.subscription_code || ((_a = paymentResult.data) === null || _a === void 0 ? void 0 : _a.subscription_code),
                                    emailToken: paymentResult.email_token || ((_b = paymentResult.data) === null || _b === void 0 ? void 0 : _b.email_token),
                                    customerCode: ((_c = paymentResult.customer) === null || _c === void 0 ? void 0 : _c.customer_code) || ((_e = (_d = paymentResult.data) === null || _d === void 0 ? void 0 : _d.customer) === null || _e === void 0 ? void 0 : _e.customer_code)
                                }
                            })];
                    case 7:
                        _g.sent();
                        _g.label = 8;
                    case 8: return [2 /*return*/, paymentResult];
                }
            });
        });
    };
    PaymentController.prototype.list = function (paymentFilterDto) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.paymentService.listPayments(paymentFilterDto)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    PaymentController.prototype.stats = function (timeframe) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.paymentService.getStats({ timeframe: timeframe || null })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    __decorate([
        common_1.UseGuards(jwt_auth_guard_1.JwtAuthGuard),
        common_1.Post('initialize'),
        __param(0, auth_user_decorator_1.AuthUser()),
        __param(1, common_1.Body())
    ], PaymentController.prototype, "initialize");
    __decorate([
        common_1.UseGuards(jwt_auth_guard_1.JwtAuthGuard),
        common_1.Post('verify'),
        __param(0, common_1.Body())
    ], PaymentController.prototype, "manualVerify");
    __decorate([
        common_1.UseGuards(product_jwt_auth_guard_1.ProductAdminJwtAuthGuard),
        common_1.Get(),
        __param(0, common_2.Query())
    ], PaymentController.prototype, "list");
    __decorate([
        common_1.UseGuards(product_jwt_auth_guard_1.ProductAdminJwtAuthGuard),
        common_1.Get('stats'),
        __param(0, common_2.Query('timeframe'))
    ], PaymentController.prototype, "stats");
    PaymentController = __decorate([
        common_1.Controller('payment')
    ], PaymentController);
    return PaymentController;
}());
exports.PaymentController = PaymentController;
