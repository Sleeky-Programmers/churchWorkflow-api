"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
exports.__esModule = true;
exports.ChurchSchema = exports.Church = void 0;
var mongoose_1 = require("@nestjs/mongoose");
var mongoose_2 = require("mongoose");
var Church = /** @class */ (function (_super) {
    __extends(Church, _super);
    function Church() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    __decorate([
        mongoose_1.Prop()
    ], Church.prototype, "name");
    __decorate([
        mongoose_1.Prop({ "default": null })
    ], Church.prototype, "alias");
    __decorate([
        mongoose_1.Prop({ "default": null })
    ], Church.prototype, "address");
    __decorate([
        mongoose_1.Prop({ "default": null })
    ], Church.prototype, "country");
    __decorate([
        mongoose_1.Prop({ "default": null })
    ], Church.prototype, "state");
    __decorate([
        mongoose_1.Prop({ "default": null })
    ], Church.prototype, "defaultCurrency");
    __decorate([
        mongoose_1.Prop({ "default": null })
    ], Church.prototype, "timeZone");
    __decorate([
        mongoose_1.Prop({ "default": null })
    ], Church.prototype, "logoUrl");
    __decorate([
        mongoose_1.Prop({ "default": false })
    ], Church.prototype, "isBlocked");
    __decorate([
        mongoose_1.Prop({ "default": null })
    ], Church.prototype, "blockedAt");
    Church = __decorate([
        mongoose_1.Schema({ timestamps: true })
    ], Church);
    return Church;
}(mongoose_2.Document));
exports.Church = Church;
exports.ChurchSchema = mongoose_1.SchemaFactory.createForClass(Church);
