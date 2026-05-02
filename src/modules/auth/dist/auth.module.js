"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.AuthModule = void 0;
var common_1 = require("@nestjs/common");
var jwt_1 = require("@nestjs/jwt");
var config_1 = require("@nestjs/config");
var auth_service_1 = require("./auth.service");
var auth_controller_1 = require("./auth.controller");
var admin_module_1 = require("../admin/admin.module");
var admin_invite_module_1 = require("../admin-invite/admin-invite.module");
var otp_module_1 = require("../otp/otp.module");
var jwt_strategy_1 = require("./strategy/jwt.strategy");
var local_strategy_1 = require("./strategy/local.strategy");
var church_module_1 = require("../church/church.module");
var AuthModule = /** @class */ (function () {
    function AuthModule() {
    }
    AuthModule = __decorate([
        common_1.Module({
            imports: [
                admin_module_1.AdminModule,
                church_module_1.ChurchModule,
                admin_invite_module_1.AdminInviteModule,
                otp_module_1.OtpModule,
                jwt_1.JwtModule.registerAsync({
                    inject: [config_1.ConfigService],
                    useFactory: function (config) { return ({
                        secret: config.get('jwt.secret'),
                        signOptions: {
                            expiresIn: config.get('jwt.expiresIn')
                        }
                    }); }
                }),
            ],
            controllers: [auth_controller_1.AuthController],
            providers: [auth_service_1.AuthService, local_strategy_1.LocalStrategy, jwt_strategy_1.JwtStrategy],
            exports: [auth_service_1.AuthService]
        })
    ], AuthModule);
    return AuthModule;
}());
exports.AuthModule = AuthModule;
