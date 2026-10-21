// Temporary: import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envConfig } from './config/env.config';
// Temporary: import { RateLimiterMiddleware } from './middlewares/RateLimiterMiddleware';
import { RateLimit, RateLimitSchema } from './schemas/rate-limit.schema';
import { AdminModule } from './modules/admin/admin.module';
import { ChurchModule } from './modules/church/church.module';
import { OtpModule } from './modules/otp/otp.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { FileUploadModule } from './modules/file-upload/file-upload.module';
import { MembersModule } from './modules/members/members.module';
import { AdminInviteModule } from './modules/admin-invite/admin-invite.module';
import { RolesModule } from './modules/roles/roles.module';
import { AccountSettingsModule } from './modules/account-settings/account-settings.module';
import { NotificationModule } from './modules/notification/notification.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { ChurchServicesModule } from './modules/church-services/church-services.module';
import { ScheduleModule } from '@nestjs/schedule';
import { AccountDeletionModule } from './modules/account-deletion/account-deletion.module';
import { SmallTeamsModule } from './modules/small-teams/small-teams.module';
import { DepartmentModule } from './modules/department/department.module';
import { SubscriptionModule } from './modules/subscription/subscription.module';
import { PaymentModule } from './modules/payment/payment.module';
import { PaystackModule } from './modules/paystack/paystack.module';
import { FlutterwaveModule } from './modules/flutterwave/flutterwave.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { SubscriptionPlanCodesModule } from './modules/subscription-plan-codes/subscription-plan-codes.module';
import { ProductAdminModule } from './modules/product-admin/product-admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AdminActivityLogModule } from './modules/admin-activity-log/admin-activity-log.module';
import { OverviewModule } from './modules/overview/overview.module';
import { BranchModule } from './modules/branch/branch.module';
import { TitleModule } from './modules/titles/title.module';
import { LocationModule } from './modules/locations/location.module';
import { ExpenseModule } from './modules/expenses/expense.module';
import { RequisitionModule } from './modules/requisitions/requisition.module';
import { GivingBatchModule } from './modules/giving-batches/giving-batch.module';
import { OfferingTypeModule } from './modules/offering-types/offering-type.module';
import { CurrencyModule } from './modules/currencies/currency.module';
import { OnlineGivingModule } from './modules/online-giving/online-giving.module';
import { PaymentMethodModule } from './modules/payment-methods/payment-method.module';
import { GivingConfigModule } from './modules/giving-config/giving-config.module';
import { AssetManagementModule } from './modules/asset-management/asset-management.module';
import { SuggestionsModule } from './modules/suggestions/suggestions.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [envConfig],
      envFilePath: '.env',
      isGlobal: true,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        uri: configService.get<string>('db.uri'),
      }),
      inject: [ConfigService],
    }),
    MongooseModule.forFeature([
      { name: RateLimit.name, schema: RateLimitSchema },
    ]),
    AuthModule,
    AdminModule,
    ChurchModule,
    OtpModule,
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('email.host'),
          port: configService.get<number>('email.port'),
          auth: {
            user: configService.get<string>('email.username'),
            pass: configService.get<string>('email.password'),
          },
        },
      }),
      inject: [ConfigService],
    }),
    EmailModule,
    FileUploadModule,
    MembersModule,
    AdminInviteModule,
    RolesModule,
    AccountSettingsModule,
    NotificationModule,
    ActivityLogModule,
    AttendanceModule,
    ChurchServicesModule,
    SmallTeamsModule,
    ScheduleModule.forRoot(),
    AccountDeletionModule,
    DepartmentModule,
    CouponModule,
    SubscriptionModule,
    PaymentModule,
    PaystackModule,
    FlutterwaveModule,
    SubscriptionPlanCodesModule,
    ProductAdminModule,
    AnalyticsModule,
    AdminActivityLogModule,
    OverviewModule,
    BranchModule,
    TitleModule,
    LocationModule,
    ExpenseModule,
    RequisitionModule,
    GivingBatchModule,
    OfferingTypeModule,
    CurrencyModule,
    OnlineGivingModule,
    PaymentMethodModule,
    GivingConfigModule,
    AssetManagementModule,
    SuggestionsModule,
    ReportsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  // Temporary: configure(consumer: MiddlewareConsumer) {
  //   Temporary: consumer
  //     .apply(RateLimiterMiddleware)
  //     .forRoutes({ path: '*', method: RequestMethod.ALL });
  // }
}
