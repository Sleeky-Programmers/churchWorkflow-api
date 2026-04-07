import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailerModule } from '@nestjs-modules/mailer';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envConfig } from './config/env.config';
import { RateLimiterMiddleware } from './middlewares/RateLimiterMiddleware';
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
    SubscriptionModule,
    PaymentModule,
    PaystackModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(RateLimiterMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
