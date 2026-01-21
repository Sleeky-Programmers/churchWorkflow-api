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
import { EventsModule } from './modules/events/events.module';
import { WeeklyServicesModule } from './modules/weekly-services/weekly-services.module';
import { MembersModule } from './modules/members/members.module';

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
    EventsModule,
    WeeklyServicesModule,
    MembersModule,
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
