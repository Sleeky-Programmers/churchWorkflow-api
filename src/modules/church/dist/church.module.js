"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.ChurchModule = void 0;
var common_1 = require("@nestjs/common");
var mongoose_1 = require("@nestjs/mongoose");
var church_service_1 = require("./church.service");
var church_controller_1 = require("./church.controller");
var church_schema_1 = require("../../schemas/church.schema");
var members_module_1 = require("../members/members.module");
var file_upload_module_1 = require("../file-upload/file-upload.module");
var admin_module_1 = require("../admin/admin.module");
var subscription_module_1 = require("../subscription/subscription.module");
var ChurchModule = /** @class */ (function () {
    function ChurchModule() {
    }
    ChurchModule = __decorate([
        common_1.Module({
            imports: [
                mongoose_1.MongooseModule.forFeature([{ name: church_schema_1.Church.name, schema: church_schema_1.ChurchSchema }]),
                file_upload_module_1.FileUploadModule,
                common_1.forwardRef(function () { return admin_module_1.AdminModule; }),
                subscription_module_1.SubscriptionModule,
                members_module_1.MembersModule,
            ],
            controllers: [church_controller_1.ChurchController],
            providers: [church_service_1.ChurchService],
            exports: [mongoose_1.MongooseModule, church_service_1.ChurchService]
        })
    ], ChurchModule);
    return ChurchModule;
}());
exports.ChurchModule = ChurchModule;
