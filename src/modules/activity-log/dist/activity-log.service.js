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
exports.ActivityLogService = void 0;
var common_1 = require("@nestjs/common");
var mongoose_1 = require("@nestjs/mongoose");
var json2csv_1 = require("json2csv");
var activity_log_schema_1 = require("../../schemas/activity-log.schema");
var pagination_helper_1 = require("../../common/helpers/pagination.helper");
var PDFDocument = require('pdfkit');
var ActivityLogService = /** @class */ (function () {
    function ActivityLogService(activityLogModel) {
        this.activityLogModel = activityLogModel;
    }
    ActivityLogService.prototype.create = function (authUser, activityLogDto) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.activityLogModel.create(__assign({ adminId: authUser._id, churchId: authUser.churchId }, activityLogDto))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ActivityLogService.prototype.findAll = function (authUser, paginationBaseDto) {
        return __awaiter(this, void 0, void 0, function () {
            var page, limit, skip, filter, _a, logs, itemCount;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        page = paginationBaseDto.page, limit = paginationBaseDto.limit;
                        skip = (page - 1) * limit;
                        filter = { churchId: authUser.churchId };
                        return [4 /*yield*/, Promise.all([
                                this.activityLogModel
                                    .find(filter)
                                    .populate('adminId', 'firstName lastName')
                                    .sort({ createdAt: -1 })
                                    .skip(skip)
                                    .limit(limit),
                                this.activityLogModel.countDocuments(filter),
                            ])];
                    case 1:
                        _a = _b.sent(), logs = _a[0], itemCount = _a[1];
                        return [2 /*return*/, {
                                data: logs,
                                pagination: pagination_helper_1.paginationMeta({
                                    page: page,
                                    limit: limit,
                                    itemCount: itemCount
                                })
                            }];
                }
            });
        });
    };
    ActivityLogService.prototype.getActivitiesSuperAdmin = function (paginationBaseDto) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, page, _b, limit, skip, _c, logs, itemCount, formattedData;
            var _this = this;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0:
                        _a = paginationBaseDto.page, page = _a === void 0 ? 1 : _a, _b = paginationBaseDto.limit, limit = _b === void 0 ? 10 : _b;
                        skip = (page - 1) * limit;
                        return [4 /*yield*/, Promise.all([
                                this.activityLogModel
                                    .find()
                                    .populate('adminId', 'firstName lastName')
                                    .populate('churchId', 'name')
                                    .sort({ createdAt: -1 })
                                    .skip(skip)
                                    .limit(limit)
                                    .lean(),
                                this.activityLogModel.countDocuments(),
                            ])];
                    case 1:
                        _c = _d.sent(), logs = _c[0], itemCount = _c[1];
                        formattedData = logs.map(function (log) {
                            var _a, _b;
                            var activity = {
                                id: log._id,
                                action: log.action,
                                module: log.module,
                                description: log.details,
                                createdAt: log.createdAt,
                                adminName: log.adminId
                                    ? log.adminId.firstName + " " + log.adminId.lastName
                                    : 'System',
                                churchName: ((_a = log.churchId) === null || _a === void 0 ? void 0 : _a.name) || 'Unknown Church',
                                churchId: ((_b = log.churchId) === null || _b === void 0 ? void 0 : _b._id) || null
                            };
                            return __assign(__assign({}, activity), { text: _this.formatActivity(activity), time: _this.formatTime(activity.createdAt), color: _this.getActivityColor(activity.module) });
                        });
                        return [2 /*return*/, {
                                data: formattedData,
                                pagination: pagination_helper_1.paginationMeta({
                                    page: page,
                                    limit: limit,
                                    itemCount: itemCount
                                })
                            }];
                }
            });
        });
    };
    ActivityLogService.prototype.getRecentActivitiesSuperAdmin = function (limit) {
        if (limit === void 0) { limit = 5; }
        return __awaiter(this, void 0, void 0, function () {
            var data;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getActivitiesSuperAdmin({
                            page: 1,
                            limit: limit
                        })];
                    case 1:
                        data = (_a.sent()).data;
                        return [2 /*return*/, data];
                }
            });
        });
    };
    ActivityLogService.prototype.findById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.activityLogModel
                            .findById(id)
                            .populate('adminId', 'firstName lastName')];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ActivityLogService.prototype["delete"] = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.activityLogModel.findByIdAndDelete(id)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ActivityLogService.prototype.deleteByAdminId = function (adminId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.activityLogModel.deleteMany({ adminId: adminId })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    ActivityLogService.prototype.exportToCSV = function (authUser, res) {
        return __awaiter(this, void 0, void 0, function () {
            var logs, formatted, parser, csv;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.activityLogModel
                            .find({ churchId: authUser.churchId })
                            .populate('adminId', 'firstName lastName')
                            .sort({ createdAt: -1 })
                            .lean()];
                    case 1:
                        logs = _a.sent();
                        formatted = logs.map(function (log) { return ({
                            Admin: log.adminId
                                ? log.adminId.firstName + " " + log.adminId.lastName
                                : 'N/A',
                            Action: log.action,
                            Description: log.description,
                            Date: log.createdAt
                        }); });
                        parser = new json2csv_1.Parser({
                            fields: ['Admin', 'Action', 'Description', 'Date']
                        });
                        csv = parser.parse(formatted);
                        res.setHeader('Content-Type', 'text/csv');
                        res.setHeader('Content-Disposition', 'attachment; filename=activity-logs.csv');
                        res.status(200).send(csv);
                        return [2 /*return*/];
                }
            });
        });
    };
    ActivityLogService.prototype.exportToPDF = function (authUser, res) {
        return __awaiter(this, void 0, void 0, function () {
            var logs, doc;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.activityLogModel
                            .find({ churchId: authUser.churchId })
                            .populate('adminId', 'firstName lastName')
                            .sort({ createdAt: -1 })];
                    case 1:
                        logs = _a.sent();
                        doc = new PDFDocument({ margin: 30 });
                        res.setHeader('Content-Type', 'application/pdf');
                        res.setHeader('Content-Disposition', 'attachment; filename=activity-logs.pdf');
                        doc.pipe(res);
                        doc.fontSize(18).text('Activity Logs Report', {
                            align: 'center'
                        });
                        doc.moveDown();
                        logs.forEach(function (log, index) {
                            var adminName = log.adminId
                                ? log.adminId.firstName + " " + log.adminId.lastName
                                : 'N/A';
                            doc.fontSize(12).text(index + 1 + ". Admin: " + adminName);
                            doc.text("Action: " + log.action);
                            doc.text("Description: " + log.description);
                            doc.text("Date: " + log.createdAt);
                            doc.moveDown();
                        });
                        doc.end();
                        return [2 /*return*/];
                }
            });
        });
    };
    ActivityLogService.prototype.formatActivity = function (log) {
        var churchName = log.churchName || 'System';
        return churchName + " \u2014 " + log.description;
    };
    ActivityLogService.prototype.formatTime = function (date) {
        var diff = Date.now() - new Date(date).getTime();
        var minutes = Math.floor(diff / (1000 * 60));
        if (minutes < 1)
            return 'Just now';
        if (minutes < 60)
            return minutes + " mins ago";
        var hours = Math.floor(minutes / 60);
        if (hours < 24)
            return hours + " hours ago";
        var days = Math.floor(hours / 24);
        if (days === 1)
            return 'Yesterday';
        return days + " days ago";
    };
    ActivityLogService.prototype.getActivityColor = function (module) {
        var map = {
            MEMBERS: 'bg-blue-500',
            SUBSCRIPTION: 'bg-green-500',
            PAYMENT: 'bg-amber-500',
            CHURCH: 'bg-purple-500'
        };
        return map[module] || 'bg-gray-400';
    };
    ActivityLogService = __decorate([
        common_1.Injectable(),
        __param(0, mongoose_1.InjectModel(activity_log_schema_1.ActivityLog.name))
    ], ActivityLogService);
    return ActivityLogService;
}());
exports.ActivityLogService = ActivityLogService;
