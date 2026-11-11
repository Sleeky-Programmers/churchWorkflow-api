import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AdminModule } from '../admin/admin.module';
import { AdminInviteModule } from '../admin-invite/admin-invite.module';
import { BranchModule } from '../branch/branch.module';
import { DepartmentModule } from '../department/department.module';
import { OtpModule } from '../otp/otp.module';
import { EmailModule } from '../email/email.module';
import { SlackModule } from '../slack/slack.module';
import { SmallTeamsModule } from '../small-teams/small-teams.module';
import { JwtStrategy } from './strategy/jwt.strategy';
import { LocalStrategy } from './strategy/local.strategy';

@Module({
  imports: [
    AdminModule,
    AdminInviteModule,
    BranchModule,
    DepartmentModule,
    OtpModule,
    EmailModule,
    SlackModule,
    SmallTeamsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        return {
          secret: config.get('jwt.secret'),
          signOptions: {
            expiresIn: config.get('jwt.expiresIn'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
