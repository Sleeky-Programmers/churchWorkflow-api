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
exports.AdminService = void 0;
var common_1 = require("@nestjs/common");
var mongoose_1 = require("@nestjs/mongoose");
var mongoose_2 = require("mongoose");
var bcrypt = require("bcryptjs");
var admin_schema_1 = require("../../schemas/admin.schema");
var email_matcher_helper_1 = require("../../common/helpers/email-matcher.helper");
var pagination_helper_1 = require("../../common/helpers/pagination.helper");
var enums_utils_1 = require("../../common/utils/enums.utils");
var AdminService = /** @class */ (function () {
    function AdminService(adminModel, churchService, rolesService, accountSettingsService) {
        this.adminModel = adminModel;
        this.churchService = churchService;
        this.rolesService = rolesService;
        this.accountSettingsService = accountSettingsService;
    }
    AdminService.prototype.countAdminsByChurch = function (churchId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel.countDocuments({ churchId: churchId })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AdminService.prototype.createAdmin = function (adminRegisterDto, churchId, churchRole, title) {
        return __awaiter(this, void 0, void 0, function () {
            var church, admin;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.churchService.findById(churchId)];
                    case 1:
                        church = _a.sent();
                        if (!church) {
                            throw new common_1.NotFoundException('Church not found');
                        }
                        return [4 /*yield*/, this.adminModel.create(__assign(__assign(__assign(__assign({}, adminRegisterDto), { email: adminRegisterDto.email.toLowerCase().trim() }), (title && { title: title })), { churchId: churchId,
                                churchRole: churchRole, isVerified: true, password: bcrypt.hashSync(adminRegisterDto.password, 10) }))];
                    case 2:
                        admin = _a.sent();
                        return [4 /*yield*/, this.accountSettingsService.createDefaultAccountSettings(admin._id)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, admin];
                }
            });
        });
    };
    AdminService.prototype.createSuperAdmin = function (createSuperAdminDto) {
        return __awaiter(this, void 0, void 0, function () {
            var roleName, superAdminRole, superAdmin;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        roleName = 'Super Admin';
                        return [4 /*yield*/, this.rolesService.ensureSystemRole(roleName)];
                    case 1:
                        superAdminRole = _a.sent();
                        if (!superAdminRole) {
                            throw new common_1.NotFoundException('Super Admin role not found');
                        }
                        return [4 /*yield*/, this.adminModel.create(__assign(__assign({}, createSuperAdminDto), { email: createSuperAdminDto.email.toLowerCase().trim(), churchRole: superAdminRole._id, password: bcrypt.hashSync(createSuperAdminDto.password, 10) }))];
                    case 2:
                        superAdmin = _a.sent();
                        return [4 /*yield*/, this.accountSettingsService.createDefaultAccountSettings(superAdmin._id)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, superAdmin];
                }
            });
        });
    };
    AdminService.prototype.findAll = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel.find({ churchId: id })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AdminService.prototype.findAllAdminWithPagination = function (churchId, dto) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, page, _b, limit, search, role, status, skip, query, _c, admins, itemCount;
            var _this = this;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _a = dto.page, page = _a === void 0 ? 1 : _a, _b = dto.limit, limit = _b === void 0 ? 20 : _b, search = dto.search, role = dto.role, status = dto.status;
                        skip = (page - 1) * limit;
                        query = {};
                        if (churchId && mongoose_2.Types.ObjectId.isValid(churchId)) {
                            query.churchId = new mongoose_2.Types.ObjectId(churchId);
                        }
                        if (status) {
                            query.status = status;
                        }
                        if (role) {
                            query.role = role;
                        }
                        if (search) {
                            query.$or = [
                                { firstName: { $regex: search, $options: 'i' } },
                                { lastName: { $regex: search, $options: 'i' } },
                                { email: { $regex: search, $options: 'i' } },
                            ];
                        }
                        return [4 /*yield*/, Promise.all([
                                this.adminModel
                                    .find(query)
                                    .sort({ createdAt: -1 })
                                    .populate({ path: 'churchId', select: 'name alias' })
                                    .populate({ path: 'churchRole', select: 'roleName' })
                                    .skip(skip)
                                    .limit(limit)
                                    .lean(),
                                this.adminModel.countDocuments(query),
                            ])];
                    case 1:
                        _c = _d.sent(), admins = _c[0], itemCount = _c[1];
                        return [2 /*return*/, {
                                data: admins.map(function (a) { return _this.mapAdmin(a); }).filter(Boolean),
                                pagination: pagination_helper_1.paginationMeta({ page: page, limit: limit, itemCount: itemCount })
                            }];
                }
            });
        });
    };
    AdminService.prototype.findOne = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel
                            .findOne({ email: email_matcher_helper_1.emailMatcher(email) })
                            .select('+password')];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AdminService.prototype.findById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel.findById(id).populate('churchRole')];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AdminService.prototype.findNamesByIds = function (ids) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel
                            .find({ _id: { $in: ids.map(function (id) { return new mongoose_2.Types.ObjectId(id); }) } })
                            .select('firstName lastName')
                            .lean()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AdminService.prototype.findOneAndUpdate = function (email, updateData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel.findOneAndUpdate({ email: email_matcher_helper_1.emailMatcher(email) }, updateData, {
                            "new": true
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AdminService.prototype.blockAdmin = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var admin;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel.findByIdAndUpdate(id, { status: enums_utils_1.ChurchAdminStatus.BLOCKED }, { "new": true })];
                    case 1:
                        admin = _a.sent();
                        if (!admin) {
                            throw new common_1.NotFoundException('Admin not found');
                        }
                        return [2 /*return*/, admin];
                }
            });
        });
    };
    AdminService.prototype.unblockAdmin = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var admin;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel.findByIdAndUpdate(id, { status: enums_utils_1.ChurchAdminStatus.ACTIVE }, { "new": true })];
                    case 1:
                        admin = _a.sent();
                        if (!admin) {
                            throw new common_1.NotFoundException('Admin not found');
                        }
                        return [2 /*return*/, admin];
                }
            });
        });
    };
    AdminService.prototype.stats = function (churchId) {
        return __awaiter(this, void 0, void 0, function () {
            var total, active, blocked, superRole, superAdmins, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.adminModel.countDocuments({ churchId: churchId })];
                    case 1:
                        total = _b.sent();
                        return [4 /*yield*/, this.adminModel.countDocuments({
                                churchId: churchId,
                                status: enums_utils_1.ChurchAdminStatus.ACTIVE
                            })];
                    case 2:
                        active = _b.sent();
                        return [4 /*yield*/, this.adminModel.countDocuments({
                                churchId: churchId,
                                status: enums_utils_1.ChurchAdminStatus.BLOCKED
                            })];
                    case 3:
                        blocked = _b.sent();
                        return [4 /*yield*/, this.rolesService.findOne('Super Admin')];
                    case 4:
                        superRole = _b.sent();
                        if (!superRole) return [3 /*break*/, 6];
                        return [4 /*yield*/, this.adminModel.countDocuments({
                                churchId: churchId,
                                churchRole: superRole._id
                            })];
                    case 5:
                        _a = _b.sent();
                        return [3 /*break*/, 7];
                    case 6:
                        _a = 0;
                        _b.label = 7;
                    case 7:
                        superAdmins = _a;
                        return [2 /*return*/, {
                                total: total,
                                active: active,
                                blocked: blocked,
                                superAdmins: superAdmins
                            }];
                }
            });
        });
    };
    AdminService.prototype.findByIdAndUpdate = function (id, updateData) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel.findByIdAndUpdate(id, updateData, {
                            "new": true
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AdminService.prototype.findOneAndDelete = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel.findOneAndDelete({
                            email: email_matcher_helper_1.emailMatcher(email)
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AdminService.prototype.findByIdAndDelete = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel.findByIdAndDelete(id)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    AdminService.prototype.mapAdmin = function (admin) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
        if (!admin) {
            return null;
        }
        return {
            id: (_d = (_c = (_b = (_a = admin === null || admin === void 0 ? void 0 : admin._id) === null || _a === void 0 ? void 0 : _a.toString) === null || _b === void 0 ? void 0 : _b.call(_a)) !== null && _c !== void 0 ? _c : admin === null || admin === void 0 ? void 0 : admin.id) !== null && _d !== void 0 ? _d : '',
            name: (((_e = admin === null || admin === void 0 ? void 0 : admin.firstName) !== null && _e !== void 0 ? _e : '') + " " + ((_f = admin === null || admin === void 0 ? void 0 : admin.lastName) !== null && _f !== void 0 ? _f : '')).trim() ||
                'Unknown User',
            email: (_g = admin === null || admin === void 0 ? void 0 : admin.email) !== null && _g !== void 0 ? _g : '',
            phone: (_h = admin === null || admin === void 0 ? void 0 : admin.phoneNumber) !== null && _h !== void 0 ? _h : '—',
            role: (_k = (_j = admin === null || admin === void 0 ? void 0 : admin.churchRole) === null || _j === void 0 ? void 0 : _j.roleName) !== null && _k !== void 0 ? _k : 'Admin',
            status: (_l = admin === null || admin === void 0 ? void 0 : admin.status) !== null && _l !== void 0 ? _l : enums_utils_1.ChurchAdminStatus.ACTIVE,
            lastActive: (_o = (_m = admin === null || admin === void 0 ? void 0 : admin.lastActive) !== null && _m !== void 0 ? _m : admin === null || admin === void 0 ? void 0 : admin.createdAt) !== null && _o !== void 0 ? _o : new Date().toISOString(),
            church: (admin === null || admin === void 0 ? void 0 : admin.churchId) ? {
                id: (_s = (_r = (_q = (_p = admin.churchId) === null || _p === void 0 ? void 0 : _p._id) === null || _q === void 0 ? void 0 : _q.toString) === null || _r === void 0 ? void 0 : _r.call(_q)) !== null && _s !== void 0 ? _s : (_t = admin.churchId) === null || _t === void 0 ? void 0 : _t.id,
                name: (_v = (_u = admin.churchId) === null || _u === void 0 ? void 0 : _u.name) !== null && _v !== void 0 ? _v : '—',
                alias: (_x = (_w = admin.churchId) === null || _w === void 0 ? void 0 : _w.alias) !== null && _x !== void 0 ? _x : 'CH'
            }
                : null
        };
    };
    AdminService.prototype.findFirstSuperAdminByChurch = function (churchId) {
        return __awaiter(this, void 0, void 0, function () {
            var superRole, admin;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.rolesService.findOne('Super Admin')];
                    case 1:
                        superRole = _a.sent();
                        if (!superRole) {
                            return [2 /*return*/, null];
                        }
                        return [4 /*yield*/, this.adminModel
                                .findOne({
                                churchId: new mongoose_2.Types.ObjectId(churchId),
                                churchRole: superRole._id
                            })
                                .sort({ createdAt: 1 })
                                .lean()];
                    case 2:
                        admin = _a.sent();
                        if (!admin) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, this.mapAdmin(admin)];
                }
            });
        });
    };
    AdminService.prototype.updateAdminProfile = function (id, updateData) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.adminModel
                            .findByIdAndUpdate(id, {
                            $set: __assign(__assign({}, updateData), (updateData.email && {
                                email: updateData.email.toLowerCase().trim()
                            }))
                        }, {
                            "new": true,
                            runValidators: true
                        })
                            .lean()];
                    case 1:
                        updated = _a.sent();
                        if (!updated) {
                            throw new common_1.NotFoundException('Admin not found');
                        }
                        return [2 /*return*/, {
                                id: updated._id.toString(),
                                firstName: updated.firstName,
                                lastName: updated.lastName,
                                email: updated.email
                            }];
                }
            });
        });
    };
    AdminService = __decorate([
        common_1.Injectable(),
        __param(0, mongoose_1.InjectModel(admin_schema_1.Admin.name))
    ], AdminService);
    return AdminService;
}());
exports.AdminService = AdminService;
