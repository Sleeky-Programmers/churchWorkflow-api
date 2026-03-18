import { Module, forwardRef } from '@nestjs/common';
import { MembersService } from './members.service';
import { MembersController } from './members.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Member, MemberSchema } from '../../schemas/member.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationModule } from '../notification/notification.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ChurchServicesModule } from '../church-services/church-services.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Member.name, schema: MemberSchema }]),
    ActivityLogModule,
    NotificationModule,
    ChurchServicesModule,
    forwardRef(() => AttendanceModule),
  ],
  controllers: [MembersController],
  providers: [MembersService],
  exports: [MembersService],
})
export class MembersModule {}
