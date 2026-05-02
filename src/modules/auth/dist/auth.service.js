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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
exports.__esModule = true;
exports.AuthService = void 0;
var common_1 = require("@nestjs/common");
var enums_utils_1 = require("src/common/utils/enums.utils");
var bcrypt = require("bcryptjs");
var mongoose_1 = require("mongoose");
var crypto_helper_1 = require("../../common/helpers/crypto.helper");
var google_auth_library_1 = require("google-auth-library");
var AuthService = /** @class */ (function () {
    function AuthService(adminService, adminInviteService, otpService, jwtService, configService, churchService) {
        this.adminService = adminService;
        this.adminInviteService = adminInviteService;
        this.otpService = otpService;
        this.jwtService = jwtService;
        this.configService = configService;
        this.churchService = churchService;
    }
    AuthService.prototype.generateTokens = function (userId) {
        var accessToken = this.jwtService.sign({ sub: userId }, {
            expiresIn: this.configService.getOrThrow('JWT_EXPIRES_IN'),
            secret: this.configService.getOrThrow('JWT_SECRET')
        });
        var refreshToken = this.jwtService.sign({ sub: userId }, {
            secret: this.configService.getOrThrow('JWT_REFRESH_SECRET'),
            expiresIn: this.configService.getOrThrow('JWT_REFRESH_EXPIRES_IN')
        });
        return { accessToken: accessToken, refreshToken: refreshToken };
    };
    AuthService.prototype.validateUser = function (email, password) {
        return __awaiter(this, void 0, void 0, function () {
            var user, isPasswordCorrect, _a, _, userWithoutPassword;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.adminService.findOne(email)];
                    case 1:
                        user = _b.sent();
                        if (!user) {
                            throw new common_1.UnauthorizedException('User not found');
                        }
                        isPasswordCorrect = bcrypt.compareSync(password, user.password);
                        if (!isPasswordCorrect) {
                            throw new common_1.UnauthorizedException('Invalid password');
                        }
                        if (!user.isVerified) {
                            throw new common_1.UnauthorizedException('Email not verified');
                        }
                        return [4 /*yield*/, this.ensureChurchNotBlocked(user.churchId)];
                    case 2:
                        _b.sent();
                        _a = user.toObject(), _ = _a.password, userWithoutPassword = __rest(_a, ["password"]);
                        return [2 /*return*/, userWithoutPassword];
                }
            });
        });
    };
    AuthService.prototype.superAdminRegister = function (registerDto) {
        return __awaiter(this, void 0, void 0, function () {
            var firstName, lastName, email, password, isExistingAdmin, otpSent, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        firstName = registerDto.firstName, lastName = registerDto.lastName, email = registerDto.email, password = registerDto.password;
                        return [4 /*yield*/, this.adminService.findOne(email)];
                    case 1:
                        isExistingAdmin = _b.sent();
                        if (isExistingAdmin) {
                            throw new common_1.ConflictException('Admin with this email already exists');
                        }
                        return [4 /*yield*/, this.adminService.createSuperAdmin({
                                firstName: firstName,
                                lastName: lastName,
                                email: email,
                                password: password
                            })];
                    case 2:
                        _b.sent();
                        otpSent = true;
                        _b.label = 3;
                    case 3:
                        _b.trys.push([3, 5, , 6]);
                        return [4 /*yield*/, this.otpService.create(email)];
                    case 4:
                        _b.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        _a = _b.sent();
                        otpSent = false;
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, {
                            message: otpSent
                                ? 'Registration successful. Please, verify your email.'
                                : 'Registration successful. Unable to send OTP. Please request a new code.',
                            otpSent: otpSent
                        }];
                }
            });
        });
    };
    AuthService.prototype.adminRegister = function (token, firstName, lastName, password) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, email, title, churchId, churchRoleId, isExistingAdmin, churchObjectId, churchRoleObjectId, admin, tokens;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _a = crypto_helper_1.decryptInvite(token), email = _a.email, title = _a.title, churchId = _a.churchId, churchRoleId = _a.churchRoleId;
                        return [4 /*yield*/, this.adminService.findOne(email)];
                    case 1:
                        isExistingAdmin = _b.sent();
                        if (isExistingAdmin) {
                            throw new common_1.ConflictException('An admin with this email already exists');
                        }
                        churchObjectId = new mongoose_1.Types.ObjectId(churchId);
                        churchRoleObjectId = new mongoose_1.Types.ObjectId(churchRoleId);
                        return [4 /*yield*/, Promise.all([
                                this.adminService.createAdmin({ firstName: firstName, lastName: lastName, email: email, password: password }, churchObjectId, churchRoleObjectId, title || null),
                                this.adminInviteService.acceptInvitation(email),
                            ])];
                    case 2:
                        admin = (_b.sent())[0];
                        tokens = this.generateTokens(admin._id.toString());
                        return [2 /*return*/, __assign({ message: 'Registration successful' }, tokens)];
                }
            });
        });
    };
    AuthService.prototype.login = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var tokens;
            return __generator(this, function (_a) {
                tokens = this.generateTokens(data._id);
                return [2 /*return*/, __assign({ user: data }, tokens)];
            });
        });
    };
    AuthService.prototype.googleLogin = function (idToken, token) {
        return __awaiter(this, void 0, void 0, function () {
            var clientId, client, payload, ticket, _a, email, firstName, lastName, existingAdmin, tokens_1, _b, _, userWithoutPassword, dummyPassword, admin, invite, churchObjectId, churchRoleObjectId, results, tokens;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!idToken) {
                            throw new common_1.BadRequestException('ID token is required');
                        }
                        clientId = this.configService.get('google.clientId');
                        client = new google_auth_library_1.OAuth2Client(clientId);
                        _c.label = 1;
                    case 1:
                        _c.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, client.verifyIdToken({
                                idToken: idToken,
                                audience: clientId
                            })];
                    case 2:
                        ticket = _c.sent();
                        payload = ticket.getPayload();
                        return [3 /*break*/, 4];
                    case 3:
                        _a = _c.sent();
                        throw new common_1.BadRequestException('Invalid ID token');
                    case 4:
                        if (!(payload === null || payload === void 0 ? void 0 : payload.email)) {
                            throw new common_1.BadRequestException('Email not found in Google token');
                        }
                        email = payload.email, firstName = payload.given_name, lastName = payload.family_name;
                        return [4 /*yield*/, this.adminService.findOne(email)];
                    case 5:
                        existingAdmin = _c.sent();
                        if (!existingAdmin) return [3 /*break*/, 7];
                        return [4 /*yield*/, this.ensureChurchNotBlocked(existingAdmin.churchId)];
                    case 6:
                        _c.sent();
                        tokens_1 = this.generateTokens(existingAdmin._id.toString());
                        _b = existingAdmin.toObject(), _ = _b.password, userWithoutPassword = __rest(_b, ["password"]);
                        return [2 /*return*/, __assign({ message: 'Login successful', user: userWithoutPassword }, tokens_1)];
                    case 7:
                        dummyPassword = Math.random().toString(36).slice(-8) +
                            Math.random().toString(36).slice(-8);
                        if (!token) return [3 /*break*/, 10];
                        invite = crypto_helper_1.decryptInvite(token);
                        if (email !== invite.email) {
                            throw new common_1.BadRequestException('Google email does not match invite email');
                        }
                        return [4 /*yield*/, this.ensureChurchNotBlocked(new mongoose_1.Types.ObjectId(invite.churchId))];
                    case 8:
                        _c.sent();
                        churchObjectId = new mongoose_1.Types.ObjectId(invite.churchId);
                        churchRoleObjectId = new mongoose_1.Types.ObjectId(invite.churchRoleId);
                        return [4 /*yield*/, Promise.all([
                                this.adminService.createAdmin({
                                    firstName: firstName,
                                    lastName: lastName,
                                    email: email,
                                    password: dummyPassword
                                }, churchObjectId, churchRoleObjectId, invite.title || null),
                                this.adminInviteService.acceptInvitation(email),
                            ])];
                    case 9:
                        results = _c.sent();
                        admin = results[0];
                        return [3 /*break*/, 13];
                    case 10: return [4 /*yield*/, this.adminService.createSuperAdmin({
                            firstName: firstName,
                            lastName: lastName,
                            email: email,
                            password: dummyPassword
                        })];
                    case 11:
                        admin = _c.sent();
                        return [4 /*yield*/, this.adminService.findOneAndUpdate(email, {
                                isVerified: true
                            })];
                    case 12:
                        _c.sent();
                        _c.label = 13;
                    case 13:
                        tokens = this.generateTokens(admin._id.toString());
                        return [2 /*return*/, __assign({ message: 'Registration successful', user: admin }, tokens)];
                }
            });
        });
    };
    AuthService.prototype.refreshToken = function (refreshToken) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, user, tokens;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!refreshToken) {
                            throw new common_1.UnauthorizedException('Refresh token missing');
                        }
                        try {
                            payload = this.jwtService.verify(refreshToken, {
                                secret: this.configService.getOrThrow('JWT_REFRESH_SECRET')
                            });
                        }
                        catch (_b) {
                            throw new common_1.UnauthorizedException('Invalid or expired refresh token');
                        }
                        return [4 /*yield*/, this.adminService.findById(payload.sub)];
                    case 1:
                        user = _a.sent();
                        if (!user) {
                            throw new common_1.UnauthorizedException('User no longer exists');
                        }
                        return [4 /*yield*/, this.ensureChurchNotBlocked(user.churchId)];
                    case 2:
                        _a.sent();
                        tokens = this.generateTokens(user._id.toString());
                        return [2 /*return*/, tokens];
                }
            });
        });
    };
    AuthService.prototype.requestOtp = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var isExistingAdmin;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminService.findOne(email)];
                    case 1:
                        isExistingAdmin = _a.sent();
                        if (!isExistingAdmin) {
                            throw new common_1.NotFoundException('Admin with this email does not exist');
                        }
                        return [4 /*yield*/, Promise.all([
                                this.adminService.findOneAndUpdate(email, { isVerified: false }),
                                this.otpService.create(email),
                            ])];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { message: 'OTP sent successfully' }];
                }
            });
        });
    };
    AuthService.prototype.verifyOtp = function (verifyOtpDto) {
        return __awaiter(this, void 0, void 0, function () {
            var email, otp, latestOtp, _a, admin, tokens;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        email = verifyOtpDto.email, otp = verifyOtpDto.otp;
                        return [4 /*yield*/, this.otpService.findLatestByEmail(email)];
                    case 1:
                        latestOtp = _b.sent();
                        if (!latestOtp || latestOtp.isUsed) {
                            throw new common_1.BadRequestException('Invalid OTP');
                        }
                        if (latestOtp.otp !== otp || latestOtp.otpExpiry < new Date()) {
                            throw new common_1.BadRequestException('Expired OTP');
                        }
                        return [4 /*yield*/, Promise.all([
                                this.otpService.markAsUsed(latestOtp._id),
                                this.adminService.findOneAndUpdate(email, { isVerified: true }),
                            ])];
                    case 2:
                        _a = _b.sent(), admin = _a[1];
                        tokens = this.generateTokens(admin._id.toString());
                        return [2 /*return*/, __assign({ message: 'Email verified' }, tokens)];
                }
            });
        });
    };
    AuthService.prototype.resetPassword = function (authUser, dto) {
        return __awaiter(this, void 0, void 0, function () {
            var newPassword, confirmNewPassword;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        newPassword = dto.newPassword, confirmNewPassword = dto.confirmNewPassword;
                        if (newPassword !== confirmNewPassword) {
                            throw new common_1.BadRequestException('Passwords do not match');
                        }
                        return [4 /*yield*/, this.adminService.findByIdAndUpdate(authUser._id, {
                                password: bcrypt.hashSync(newPassword, 10)
                            })];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, { message: 'Password reset successful' }];
                }
            });
        });
    };
    AuthService.prototype.changePassword = function (authUser, dto) {
        return __awaiter(this, void 0, void 0, function () {
            var currentPassword, newPassword, confirmNewPassword, user, isMatch, isSamePassword;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        currentPassword = dto.currentPassword, newPassword = dto.newPassword, confirmNewPassword = dto.confirmNewPassword;
                        if (newPassword !== confirmNewPassword) {
                            throw new common_1.BadRequestException('Passwords do not match');
                        }
                        return [4 /*yield*/, this.adminService.findById(authUser._id)];
                    case 1:
                        user = _a.sent();
                        if (!user) {
                            throw new common_1.NotFoundException('User not found');
                        }
                        isMatch = bcrypt.compareSync(currentPassword, user.password);
                        if (!isMatch) {
                            throw new common_1.UnauthorizedException('Current password is incorrect');
                        }
                        isSamePassword = bcrypt.compareSync(newPassword, user.password);
                        if (isSamePassword) {
                            throw new common_1.BadRequestException('New password cannot be the same as current password');
                        }
                        return [4 /*yield*/, this.adminService.findByIdAndUpdate(authUser._id, {
                                password: bcrypt.hashSync(newPassword, 10)
                            })];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, { message: 'Password updated successfully' }];
                }
            });
        });
    };
    AuthService.prototype.ensureChurchNotBlocked = function (churchId) {
        return __awaiter(this, void 0, void 0, function () {
            var church;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!churchId)
                            return [2 /*return*/];
                        return [4 /*yield*/, this.churchService.findById(churchId)];
                    case 1:
                        church = _a.sent();
                        if (!church)
                            return [2 /*return*/];
                        if (church.status == enums_utils_1.ChurchStatus.BLOCKED) {
                            throw new common_1.UnauthorizedException('Your church has been blocked. Contact support.');
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    AuthService = __decorate([
        common_1.Injectable()
    ], AuthService);
    return AuthService;
}());
exports.AuthService = AuthService;
