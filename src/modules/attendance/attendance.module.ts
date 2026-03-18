import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import {
  ChurchService,
  ChurchServiceSchema,
} from '../../schemas/church-service.schema';
import { MembersModule } from '../members/members.module';
import { Member, MemberSchema } from '../../schemas/member.schema';
import { Admin, AdminSchema } from '../../schemas/admin.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: ChurchService.name, schema: ChurchServiceSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
    MembersModule,
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
