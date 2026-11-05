import { Module, forwardRef } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { PastoralService } from './pastoral.service';
import { PastoralController } from './pastoral.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Member, MemberSchema } from '../../schemas/member.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import {
  ChurchService,
  ChurchServiceSchema,
} from '../../schemas/church-service.schema';
import {
  MemberPastoralSettings,
  MemberPastoralSettingsSchema,
} from '../../schemas/member-pastoral-settings.schema';
import {
  PastoralAlert,
  PastoralAlertSchema,
} from '../../schemas/pastoral-alert.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationModule } from '../notification/notification.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ChurchServicesModule } from '../church-services/church-services.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { Department, DepartmentSchema } from '../../schemas/department.schema';
import { SmallTeam, SmallTeamSchema } from '../../schemas/small-team.schema';
import { GuestRulesService } from './guest-rules.service';
import { GuestLifecycleService } from './guest-lifecycle.service';
import { InternalCronController } from './internal-cron.controller';
import { Admin, AdminSchema } from '../../schemas/admin.schema';
import { EmailModule } from '../email/email.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: ChurchService.name, schema: ChurchServiceSchema },
      {
        name: MemberPastoralSettings.name,
        schema: MemberPastoralSettingsSchema,
      },
      { name: PastoralAlert.name, schema: PastoralAlertSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: SmallTeam.name, schema: SmallTeamSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
    ConfigModule,
    EmailModule,
    ActivityLogModule,
    NotificationModule,
    ChurchServicesModule,
    forwardRef(() => AttendanceModule),
    SubscriptionModule,
  ],
  controllers: [MembersController, PastoralController, InternalCronController],
  providers: [
    MembersService,
    PastoralService,
    GuestRulesService,
    GuestLifecycleService,
  ],
  exports: [MembersService, GuestRulesService],
})
export class MembersModule {}
