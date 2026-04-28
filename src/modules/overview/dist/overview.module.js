"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.OverviewModule = void 0;
var common_1 = require("@nestjs/common");
var mongoose_1 = require("@nestjs/mongoose");
var overview_service_1 = require("./overview.service");
var overview_controller_1 = require("./overview.controller");
var church_module_1 = require("../church/church.module");
var members_module_1 = require("../members/members.module");
var subscription_module_1 = require("../subscription/subscription.module");
var activity_log_module_1 = require("../activity-log/activity-log.module");
var OverviewModule = /** @class */ (function () {
    function OverviewModule() {
    }
    OverviewModule = __decorate([
        common_1.Module({
            imports: [
                mongoose_1.MongooseModule.forFeature([]),
                church_module_1.ChurchModule,
                members_module_1.MembersModule,
                subscription_module_1.SubscriptionModule,
                activity_log_module_1.ActivityLogModule
            ],
            controllers: [overview_controller_1.OverviewController],
            providers: [overview_service_1.OverviewService]
        })
    ], OverviewModule);
    return OverviewModule;
}());
exports.OverviewModule = OverviewModule;
