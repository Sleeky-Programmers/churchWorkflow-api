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
exports.ChurchController = void 0;
var common_1 = require("@nestjs/common");
var platform_express_1 = require("@nestjs/platform-express");
var auth_user_decorator_1 = require("../../common/decorators/auth-user.decorator");
var jwt_auth_guard_1 = require("../auth/guard/jwt-auth.guard");
var roles_guard_1 = require("../../common/guards/roles.guard");
var roles_decorator_1 = require("../../common/decorators/roles.decorator");
var mongoose_1 = require("mongoose");
var product_jwt_auth_guard_1 = require("../product-admin/guard/product-jwt-auth.guard");
var ChurchController = /** @class */ (function () {
    function ChurchController(churchService) {
        this.churchService = churchService;
    }
    ChurchController.prototype.getMyChurch = function (authUser) {
        return this.churchService.findCurrentChurch(authUser);
    };
    ChurchController.prototype.getAllChurches = function (filter) {
        return this.churchService.findAll(filter);
    };
    ChurchController.prototype.getChurchById = function (id) {
        return this.churchService.findDetailsById(id);
    };
    ChurchController.prototype.createChurch = function (authUser, churchIdentityDto, file) {
        return this.churchService.create(authUser, churchIdentityDto, file);
    };
    ChurchController.prototype.updateChurch = function (user, body, file) {
        return __awaiter(this, void 0, void 0, function () {
            var church;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.churchService.findCurrentChurch(user)];
                    case 1:
                        church = _a.sent();
                        return [2 /*return*/, this.churchService.update(church._id, body, file)];
                }
            });
        });
    };
    ChurchController.prototype.blockChurch = function (id) {
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid church ID');
        }
        return this.churchService.blockChurch(new mongoose_1.Types.ObjectId(id));
    };
    ChurchController.prototype.unblockChurch = function (id) {
        if (!mongoose_1.Types.ObjectId.isValid(id)) {
            throw new common_1.BadRequestException('Invalid church ID');
        }
        return this.churchService.unblockChurch(new mongoose_1.Types.ObjectId(id));
    };
    __decorate([
        common_1.UseGuards(jwt_auth_guard_1.JwtAuthGuard),
        common_1.Get('me'),
        __param(0, auth_user_decorator_1.AuthUser())
    ], ChurchController.prototype, "getMyChurch");
    __decorate([
        common_1.UseGuards(product_jwt_auth_guard_1.ProductAdminJwtAuthGuard),
        common_1.Get(),
        __param(0, common_1.Query())
    ], ChurchController.prototype, "getAllChurches");
    __decorate([
        common_1.UseGuards(product_jwt_auth_guard_1.ProductAdminJwtAuthGuard),
        common_1.Get(':id'),
        __param(0, common_1.Param('id'))
    ], ChurchController.prototype, "getChurchById");
    __decorate([
        common_1.UseGuards(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
        common_1.Post(),
        roles_decorator_1.Roles('Super Admin'),
        common_1.UseInterceptors(platform_express_1.FileInterceptor('file')),
        __param(0, auth_user_decorator_1.AuthUser()),
        __param(1, common_1.Body()),
        __param(2, common_1.UploadedFile())
    ], ChurchController.prototype, "createChurch");
    __decorate([
        common_1.UseGuards(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
        common_1.Patch('me'),
        roles_decorator_1.Roles('Super Admin'),
        common_1.UseInterceptors(platform_express_1.FileInterceptor('file')),
        __param(0, auth_user_decorator_1.AuthUser()),
        __param(1, common_1.Body()),
        __param(2, common_1.UploadedFile())
    ], ChurchController.prototype, "updateChurch");
    __decorate([
        common_1.UseGuards(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
        common_1.Patch(':id/block'),
        roles_decorator_1.Roles('Super Admin'),
        __param(0, common_1.Param('id'))
    ], ChurchController.prototype, "blockChurch");
    __decorate([
        common_1.UseGuards(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
        common_1.Patch(':id/unblock'),
        roles_decorator_1.Roles('Super Admin'),
        __param(0, common_1.Param('id'))
    ], ChurchController.prototype, "unblockChurch");
    ChurchController = __decorate([
        common_1.Controller('church')
    ], ChurchController);
    return ChurchController;
}());
exports.ChurchController = ChurchController;
