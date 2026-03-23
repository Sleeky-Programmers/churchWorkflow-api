import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { MembersModule } from '../members/members.module';
import { ChurchServicesModule } from '../church-services/church-services.module';
import {
  ChurchService,
  ChurchServiceSchema,
} from '../../schemas/church-service.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Attendance.name, schema: AttendanceSchema },
      { name: ChurchService.name, schema: ChurchServiceSchema },
    ]),
    ChurchServicesModule,
    forwardRef(() => MembersModule),
  ],
  controllers: [AttendanceController],
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
