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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
exports.__esModule = true;
exports.MembersService = void 0;
var common_1 = require("@nestjs/common");
var mongoose_1 = require("@nestjs/mongoose");
var attendance_service_1 = require("../attendance/attendance.service");
var church_services_service_1 = require("../church-services/church-services.service");
var mongoose_2 = require("mongoose");
var class_transformer_1 = require("class-transformer");
var class_validator_1 = require("class-validator");
var stream_1 = require("stream");
var member_schema_1 = require("../../schemas/member.schema");
var enums_utils_1 = require("../../common/utils/enums.utils");
var create_member_dto_1 = require("./dto/create-member.dto");
var pagination_helper_1 = require("../../common/helpers/pagination.helper");
var normalize_helper_1 = require("../../common/helpers/normalize.helper");
var const_utils_1 = require("../../common/utils/const.utils");
var csv = require('csv-parser');
var MembersService = /** @class */ (function () {
    function MembersService(memberModel, attendanceService, churchServicesService, activityLogService, notificationService) {
        this.memberModel = memberModel;
        this.attendanceService = attendanceService;
        this.churchServicesService = churchServicesService;
        this.activityLogService = activityLogService;
        this.notificationService = notificationService;
    }
    MembersService.prototype.countMembersByChurch = function (churchId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.memberModel.countDocuments({
                            churchId: new mongoose_2.Types.ObjectId(churchId)
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MembersService.prototype.getMemberAttendanceStats = function (id, dto) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.attendanceService.getMemberAttendanceStatsFilter(id, dto.days)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MembersService.prototype.getMemberAttendance = function (id, dto) {
        return __awaiter(this, void 0, void 0, function () {
            var page, limit, serviceType, serviceId, skip, serviceIds, _a, attendances, itemCount, formattedData;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        page = dto.page, limit = dto.limit, serviceType = dto.serviceType, serviceId = dto.serviceId;
                        skip = (page - 1) * limit;
                        serviceIds = undefined;
                        if (!serviceId) return [3 /*break*/, 1];
                        serviceIds = [new mongoose_2.Types.ObjectId(serviceId)];
                        return [3 /*break*/, 3];
                    case 1:
                        if (!serviceType) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.churchServicesService.getServiceIdsByType(serviceType)];
                    case 2:
                        serviceIds =
                            _b.sent();
                        _b.label = 3;
                    case 3: return [4 /*yield*/, this.attendanceService.getMemberAttendanceFilter(id, limit, skip, serviceIds)];
                    case 4:
                        _a = _b.sent(), attendances = _a.attendances, itemCount = _a.itemCount;
                        formattedData = attendances.map(function (record) {
                            var _a, _b;
                            return ({
                                _id: record._id,
                                date: record.date,
                                status: record.status,
                                serviceName: (_a = record.churchServiceId) === null || _a === void 0 ? void 0 : _a.serviceName,
                                serviceType: (_b = record.churchServiceId) === null || _b === void 0 ? void 0 : _b.type,
                                recordedBy: record.recordedBy.firstName + " " + record.recordedBy.lastName,
                                timestamp: record.createdAt
                            });
                        });
                        return [2 /*return*/, {
                                data: formattedData,
                                pagination: pagination_helper_1.paginationMeta({ page: page, limit: limit, itemCount: itemCount })
                            }];
                }
            });
        });
    };
    MembersService.prototype.createMembersByCsv = function (authUser, fileBuffer) {
        var e_1, _a;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
        return __awaiter(this, void 0, void 0, function () {
            var members, errors, existingEmailSet, existingIdentitySet, batchEmailSet, batchIdentitySet, rowIndex, existingMembers, _i, existingMembers_1, member, emailKey, identityKey, stream, stream_2, stream_2_1, row, rowErrors, normalizedGender, birthday, dateOfMarriage, dateJoined, normalizedTitle, normalizedMaritalStatus, normalizedMembershipStatus, isBaptized, parsedData, emailKey, identityKey, dtoInstance, validationErrors, err_1, e_1_1, _v, insertedDocs;
            return __generator(this, function (_w) {
                switch (_w.label) {
                    case 0:
                        members = [];
                        errors = [];
                        existingEmailSet = new Set();
                        existingIdentitySet = new Set();
                        batchEmailSet = new Set();
                        batchIdentitySet = new Set();
                        rowIndex = 1;
                        return [4 /*yield*/, this.memberModel
                                .find({ churchId: authUser.churchId })
                                .select('email fullName phoneNumber birthday')
                                .lean()];
                    case 1:
                        existingMembers = _w.sent();
                        for (_i = 0, existingMembers_1 = existingMembers; _i < existingMembers_1.length; _i++) {
                            member = existingMembers_1[_i];
                            emailKey = normalize_helper_1.normalizeText(member.email);
                            if (emailKey) {
                                existingEmailSet.add(emailKey);
                            }
                            identityKey = [
                                normalize_helper_1.normalizeText(member.fullName),
                                normalize_helper_1.normalizeDateKey(member.birthday),
                                normalize_helper_1.normalizeText(member.phoneNumber),
                            ].join('|');
                            if (identityKey !== '||') {
                                existingIdentitySet.add(identityKey);
                            }
                        }
                        stream = stream_1.Readable.from(fileBuffer).pipe(csv());
                        _w.label = 2;
                    case 2:
                        _w.trys.push([2, 18, , 19]);
                        _w.label = 3;
                    case 3:
                        _w.trys.push([3, 11, 12, 17]);
                        stream_2 = __asyncValues(stream);
                        _w.label = 4;
                    case 4: return [4 /*yield*/, stream_2.next()];
                    case 5:
                        if (!(stream_2_1 = _w.sent(), !stream_2_1.done)) return [3 /*break*/, 10];
                        row = stream_2_1.value;
                        rowIndex++;
                        _w.label = 6;
                    case 6:
                        _w.trys.push([6, 8, , 9]);
                        rowErrors = [];
                        if (!((_b = row.fullName) === null || _b === void 0 ? void 0 : _b.trim())) {
                            rowErrors.push({
                                column: 'fullName',
                                reason: 'Full name is required'
                            });
                        }
                        normalizedGender = const_utils_1.GENDER_MAP[normalize_helper_1.normalizeKey(row.gender)];
                        if (!((_c = row.gender) === null || _c === void 0 ? void 0 : _c.trim())) {
                            rowErrors.push({
                                column: 'gender',
                                reason: 'Gender is required'
                            });
                        }
                        else if (!normalizedGender) {
                            rowErrors.push({
                                column: 'gender',
                                reason: "Invalid gender \"" + row.gender + "\". Allowed values: MALE or FEMALE"
                            });
                        }
                        birthday = normalize_helper_1.parseOptionalDate(row.birthday);
                        if (((_d = row.birthday) === null || _d === void 0 ? void 0 : _d.trim()) && !birthday) {
                            rowErrors.push({
                                column: 'birthday',
                                reason: 'Invalid birthday date format'
                            });
                        }
                        dateOfMarriage = normalize_helper_1.parseOptionalDate(row.dateOfMarriage);
                        if (((_e = row.dateOfMarriage) === null || _e === void 0 ? void 0 : _e.trim()) && !dateOfMarriage) {
                            rowErrors.push({
                                column: 'dateOfMarriage',
                                reason: 'Invalid dateOfMarriage format'
                            });
                        }
                        dateJoined = normalize_helper_1.parseOptionalDate(row.dateJoined);
                        if (((_f = row.dateJoined) === null || _f === void 0 ? void 0 : _f.trim()) && !dateJoined) {
                            rowErrors.push({
                                column: 'dateJoined',
                                reason: 'Invalid dateJoined format'
                            });
                        }
                        normalizedTitle = const_utils_1.TITLE_MAP[normalize_helper_1.normalizeKey(row.title)] || null;
                        if (((_g = row.title) === null || _g === void 0 ? void 0 : _g.trim()) && !normalizedTitle) {
                            rowErrors.push({
                                column: 'title',
                                reason: "Invalid title \"" + row.title + "\""
                            });
                        }
                        normalizedMaritalStatus = const_utils_1.MARITAL_STATUS_MAP[normalize_helper_1.normalizeKey(row.maritalStatus)];
                        if (((_h = row.maritalStatus) === null || _h === void 0 ? void 0 : _h.trim()) &&
                            normalizedMaritalStatus === undefined) {
                            rowErrors.push({
                                column: 'maritalStatus',
                                reason: "Invalid maritalStatus \"" + row.maritalStatus + "\""
                            });
                        }
                        normalizedMembershipStatus = const_utils_1.MEMBERSHIP_STATUS_MAP[normalize_helper_1.normalizeKey(row.membershipStatus)] ||
                            enums_utils_1.MembershipStatus.MEMBER;
                        isBaptized = normalize_helper_1.parseBoolean(row.isBaptized);
                        if (((_j = row.isBaptized) === null || _j === void 0 ? void 0 : _j.trim()) && isBaptized === null) {
                            rowErrors.push({
                                column: 'isBaptized',
                                reason: 'isBaptized must be true/false, yes/no, or 1/0'
                            });
                        }
                        if (rowErrors.length) {
                            rowErrors.forEach(function (err) {
                                return errors.push(__assign({ row: rowIndex }, err));
                            });
                            return [3 /*break*/, 9];
                        }
                        parsedData = {
                            title: normalizedTitle,
                            fullName: (_k = row.fullName) === null || _k === void 0 ? void 0 : _k.trim(),
                            gender: normalizedGender,
                            birthday: birthday,
                            maritalStatus: normalizedMaritalStatus,
                            dateOfMarriage: dateOfMarriage,
                            phoneNumber: (_l = row.phoneNumber) === null || _l === void 0 ? void 0 : _l.trim(),
                            email: (_o = (_m = row.email) === null || _m === void 0 ? void 0 : _m.toLowerCase()) === null || _o === void 0 ? void 0 : _o.trim(),
                            occupation: (_p = row.occupation) === null || _p === void 0 ? void 0 : _p.trim(),
                            educationalBackground: (_q = row.educationalBackground) === null || _q === void 0 ? void 0 : _q.trim(),
                            membershipStatus: normalizedMembershipStatus,
                            dateJoined: dateJoined,
                            previousChurchMembership: (_r = row.previousChurchMembership) === null || _r === void 0 ? void 0 : _r.trim(),
                            isBaptized: isBaptized,
                            ministries: (_s = row.ministries) === null || _s === void 0 ? void 0 : _s.trim(),
                            volunteerPreferences: (_t = row.volunteerPreferences) === null || _t === void 0 ? void 0 : _t.trim(),
                            cellGroupName: (_u = row.cellGroupName) === null || _u === void 0 ? void 0 : _u.trim()
                        };
                        emailKey = normalize_helper_1.normalizeText(parsedData.email);
                        if (emailKey &&
                            (existingEmailSet.has(emailKey) || batchEmailSet.has(emailKey))) {
                            rowErrors.push({
                                column: 'email',
                                reason: 'Member with this email already exists'
                            });
                        }
                        identityKey = [
                            normalize_helper_1.normalizeText(parsedData.fullName),
                            normalize_helper_1.normalizeDateKey(parsedData.birthday),
                            normalize_helper_1.normalizeText(parsedData.phoneNumber),
                        ].join('|');
                        if (identityKey !== '||' &&
                            (existingIdentitySet.has(identityKey) ||
                                batchIdentitySet.has(identityKey))) {
                            rowErrors.push({
                                column: 'fullName',
                                reason: 'Duplicate member record already exists'
                            });
                        }
                        if (rowErrors.length) {
                            rowErrors.forEach(function (err) {
                                return errors.push(__assign({ row: rowIndex }, err));
                            });
                            return [3 /*break*/, 9];
                        }
                        dtoInstance = class_transformer_1.plainToInstance(create_member_dto_1.CreateMemberDto, parsedData);
                        return [4 /*yield*/, class_validator_1.validate(dtoInstance)];
                    case 7:
                        validationErrors = _w.sent();
                        if (validationErrors.length > 0) {
                            validationErrors.forEach(function (err) {
                                var message = Object.values(err.constraints || {}).join(', ');
                                errors.push({
                                    row: rowIndex,
                                    column: err.property,
                                    reason: message
                                });
                            });
                            return [3 /*break*/, 9];
                        }
                        members.push(__assign({ churchId: authUser.churchId }, dtoInstance));
                        if (emailKey) {
                            batchEmailSet.add(emailKey);
                        }
                        if (identityKey !== '||') {
                            batchIdentitySet.add(identityKey);
                        }
                        return [3 /*break*/, 9];
                    case 8:
                        err_1 = _w.sent();
                        errors.push({
                            row: rowIndex,
                            reason: err_1.message || 'Unexpected error'
                        });
                        return [3 /*break*/, 9];
                    case 9: return [3 /*break*/, 4];
                    case 10: return [3 /*break*/, 17];
                    case 11:
                        e_1_1 = _w.sent();
                        e_1 = { error: e_1_1 };
                        return [3 /*break*/, 17];
                    case 12:
                        _w.trys.push([12, , 15, 16]);
                        if (!(stream_2_1 && !stream_2_1.done && (_a = stream_2["return"]))) return [3 /*break*/, 14];
                        return [4 /*yield*/, _a.call(stream_2)];
                    case 13:
                        _w.sent();
                        _w.label = 14;
                    case 14: return [3 /*break*/, 16];
                    case 15:
                        if (e_1) throw e_1.error;
                        return [7 /*endfinally*/];
                    case 16: return [7 /*endfinally*/];
                    case 17: return [3 /*break*/, 19];
                    case 18:
                        _v = _w.sent();
                        throw new common_1.BadRequestException('Failed to parse CSV file');
                    case 19:
                        if (errors.length > 0) {
                            throw new common_1.BadRequestException({
                                message: 'CSV validation failed. No members were imported.',
                                totalErrors: errors.length,
                                errors: errors
                            });
                        }
                        return [4 /*yield*/, this.memberModel.insertMany(members)];
                    case 20:
                        insertedDocs = _w.sent();
                        return [4 /*yield*/, this.activityLogService.create(authUser, {
                                action: 'Bulk Member Import',
                                module: enums_utils_1.ModuleSections.MEMBERS,
                                details: "Imported " + insertedDocs.length + " members via CSV."
                            })];
                    case 21:
                        _w.sent();
                        return [4 /*yield*/, this.notificationService.createNotification(authUser.churchId, {
                                title: 'Members Imported',
                                body: insertedDocs.length + " members were successfully imported.",
                                type: enums_utils_1.NotificationType.MEMBER
                            })];
                    case 22:
                        _w.sent();
                        return [2 /*return*/, {
                                inserted: insertedDocs.length
                            }];
                }
            });
        });
    };
    MembersService.prototype.addMember = function (authUser, createMemberDto) {
        return __awaiter(this, void 0, void 0, function () {
            var payload, createdMember;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        payload = __assign(__assign({}, createMemberDto), { membershipStatus: createMemberDto.membershipStatus || enums_utils_1.MembershipStatus.MEMBER });
                        return [4 /*yield*/, this.memberModel.create(__assign({ churchId: authUser.churchId }, payload))];
                    case 1:
                        createdMember = _a.sent();
                        return [4 /*yield*/, this.activityLogService.create(authUser, {
                                action: 'Created Member',
                                module: enums_utils_1.ModuleSections.MEMBERS,
                                details: "Created member: " + createdMember.fullName
                            })];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, this.notificationService.createNotification(authUser.churchId, {
                                title: 'New Member Added',
                                body: createdMember.fullName + " has been added as a member.",
                                type: enums_utils_1.NotificationType.MEMBER
                            })];
                    case 3:
                        _a.sent();
                        return [2 /*return*/, createdMember];
                }
            });
        });
    };
    MembersService.prototype.getMemberStats = function (authUser) {
        return __awaiter(this, void 0, void 0, function () {
            var churchId, totalMembers, thirtyDaysAgo, previousTotal, growthValue, difference, growthText;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        churchId = authUser.churchId;
                        return [4 /*yield*/, this.memberModel.countDocuments({ churchId: churchId })];
                    case 1:
                        totalMembers = _a.sent();
                        thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return [4 /*yield*/, this.memberModel.countDocuments({
                                churchId: churchId,
                                createdAt: { $lt: thirtyDaysAgo }
                            })];
                    case 2:
                        previousTotal = _a.sent();
                        growthValue = 0;
                        if (previousTotal === 0) {
                            growthValue = totalMembers > 0 ? 100 : 0;
                        }
                        else {
                            difference = totalMembers - previousTotal;
                            growthValue = (difference / previousTotal) * 100;
                        }
                        growthText = growthValue >= 0
                            ? "+" + growthValue.toFixed(0) + "%"
                            : growthValue.toFixed(0) + "%";
                        return [2 /*return*/, {
                                totalMembers: totalMembers,
                                growth: growthText
                            }];
                }
            });
        });
    };
    MembersService.prototype.getAllMembers = function (authUser, dto) {
        return __awaiter(this, void 0, void 0, function () {
            var page, limit, search, filter, skip, query, thirtyDaysAgo, _a, members, itemCount;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        page = dto.page, limit = dto.limit, search = dto.search, filter = dto.filter;
                        skip = (page - 1) * limit;
                        query = { churchId: authUser.churchId };
                        if (search) {
                            query.$or = [
                                { fullName: { $regex: search, $options: 'i' } },
                                { email: { $regex: search, $options: 'i' } },
                                { phoneNumber: { $regex: search, $options: 'i' } },
                            ];
                        }
                        switch (filter) {
                            case enums_utils_1.MemberFilter.MALE:
                                query.gender = enums_utils_1.Gender.MALE;
                                break;
                            case enums_utils_1.MemberFilter.FEMALE:
                                query.gender = enums_utils_1.Gender.FEMALE;
                                break;
                            case enums_utils_1.MemberFilter.MARRIED:
                                query.maritalStatus = enums_utils_1.MaritalStatus.MARRIED;
                                break;
                            case enums_utils_1.MemberFilter.SINGLE:
                                query.maritalStatus = enums_utils_1.MaritalStatus.SINGLE;
                                break;
                            case enums_utils_1.MemberFilter.DIVORCED:
                                query.maritalStatus = enums_utils_1.MaritalStatus.DIVORCED;
                                break;
                            case enums_utils_1.MemberFilter.WIDOWED:
                                query.maritalStatus = enums_utils_1.MaritalStatus.WIDOWED;
                                break;
                            case enums_utils_1.MemberFilter.VISITOR:
                                query.membershipStatus = enums_utils_1.MembershipStatus.VISITOR;
                                break;
                            case enums_utils_1.MemberFilter.VOLUNTEER:
                                query.membershipStatus = enums_utils_1.MembershipStatus.VOLUNTEER;
                                break;
                            case enums_utils_1.MemberFilter.LEADER:
                                query.membershipStatus = enums_utils_1.MembershipStatus.LEADER;
                                break;
                            case enums_utils_1.MemberFilter.MEMBER:
                                query.membershipStatus = enums_utils_1.MembershipStatus.MEMBER;
                                break;
                            case enums_utils_1.MemberFilter.WORKER:
                                query.membershipStatus = enums_utils_1.MembershipStatus.WORKER;
                                break;
                            case enums_utils_1.MemberFilter.CONVERT:
                                query.membershipStatus = enums_utils_1.MembershipStatus.CONVERT;
                                break;
                            case enums_utils_1.MemberFilter.IS_BAPTIZED:
                                query.isBaptized = true;
                                break;
                            case enums_utils_1.MemberFilter.NEW_MEMBERS:
                                thirtyDaysAgo = new Date();
                                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                                query.dateJoined = { $gte: thirtyDaysAgo };
                                break;
                            default:
                                break;
                        }
                        return [4 /*yield*/, Promise.all([
                                this.memberModel.find(query).skip(skip).limit(limit),
                                this.memberModel.countDocuments(query),
                            ])];
                    case 1:
                        _a = _b.sent(), members = _a[0], itemCount = _a[1];
                        return [2 /*return*/, {
                                data: members,
                                pagination: pagination_helper_1.paginationMeta({ page: page, limit: limit, itemCount: itemCount })
                            }];
                }
            });
        });
    };
    MembersService.prototype.getAllMembersNoPagination = function (authUser) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.memberModel.find({ churchId: authUser.churchId })];
            });
        });
    };
    MembersService.prototype.findAll = function (authUser) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.memberModel.find({ churchId: authUser.churchId })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MembersService.prototype.findByIdInChurch = function (memberId, churchId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.memberModel
                            .findOne({
                            _id: memberId,
                            churchId: churchId
                        })
                            .select('_id fullName')
                            .lean()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MembersService.prototype.countMembersInChurch = function (memberIds, churchId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.memberModel.countDocuments({
                            _id: { $in: memberIds.map(function (id) { return new mongoose_2.Types.ObjectId(id); }) },
                            churchId: churchId
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MembersService.prototype.existsInChurch = function (memberId, churchId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.memberModel.exists({
                            _id: new mongoose_2.Types.ObjectId(memberId),
                            churchId: churchId
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MembersService.prototype.countAllMembers = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.memberModel.countDocuments()];
            });
        });
    };
    MembersService.prototype.getMemberById = function (id, dto) {
        return __awaiter(this, void 0, Promise, function () {
            var page, limit, _a, member, attendanceStats, attendance;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        page = (dto === null || dto === void 0 ? void 0 : dto.page) || 1;
                        limit = (dto === null || dto === void 0 ? void 0 : dto.limit) || 10;
                        return [4 /*yield*/, Promise.all([
                                this.memberModel.findById(id).lean(),
                                this.attendanceService.getMemberAttendanceStatsFilter(id),
                                this.getMemberAttendance(id, __assign(__assign({}, dto), { page: page, limit: limit })),
                            ])];
                    case 1:
                        _a = _b.sent(), member = _a[0], attendanceStats = _a[1], attendance = _a[2];
                        if (!member) {
                            return [2 /*return*/, null];
                        }
                        return [2 /*return*/, __assign(__assign({}, member), { attendanceStats: attendanceStats, attendanceList: attendance.data, attendancePagination: attendance.pagination })];
                }
            });
        });
    };
    MembersService.prototype.topChurchesByMembers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var topChurchByMembers;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.memberModel.aggregate([
                            {
                                $group: {
                                    _id: '$churchId',
                                    membersCount: { $sum: 1 }
                                }
                            },
                            { $sort: { membersCount: -1 } },
                            { $limit: 10 },
                            {
                                $lookup: {
                                    from: 'churches',
                                    localField: '_id',
                                    foreignField: '_id',
                                    as: 'church'
                                }
                            },
                            {
                                $unwind: {
                                    path: '$church',
                                    preserveNullAndEmptyArrays: true
                                }
                            },
                            {
                                $lookup: {
                                    from: 'subscriptions',
                                    let: { churchId: '$_id' },
                                    pipeline: [
                                        { $match: { $expr: { $eq: ['$churchId', '$$churchId'] } } },
                                        { $limit: 1 },
                                    ],
                                    as: 'subscription'
                                }
                            },
                            {
                                $unwind: {
                                    path: '$subscription',
                                    preserveNullAndEmptyArrays: true
                                }
                            },
                            {
                                $project: {
                                    _id: 0,
                                    id: '$_id',
                                    name: '$church.name',
                                    location: {
                                        $concat: [
                                            { $ifNull: ['$church.state', ''] },
                                            ', ',
                                            { $ifNull: ['$church.country', ''] },
                                        ]
                                    },
                                    membersCount: 1,
                                    plan: '$subscription.plan'
                                }
                            },
                        ])];
                    case 1:
                        topChurchByMembers = _a.sent();
                        return [2 /*return*/, { topChurchByMembers: topChurchByMembers }];
                }
            });
        });
    };
    MembersService.prototype.updateMember = function (id, updateMemberDto) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.memberModel.findByIdAndUpdate(id, updateMemberDto, {
                            "new": true
                        })];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MembersService.prototype.deleteMember = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.memberModel.findByIdAndDelete(id)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MembersService = __decorate([
        common_1.Injectable(),
        __param(0, mongoose_1.InjectModel(member_schema_1.Member.name)),
        __param(1, common_1.Inject(common_1.forwardRef(function () { return attendance_service_1.AttendanceService; }))),
        __param(2, common_1.Inject(common_1.forwardRef(function () { return church_services_service_1.ChurchServicesService; })))
    ], MembersService);
    return MembersService;
}());
exports.MembersService = MembersService;
