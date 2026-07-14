import { Module } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentController } from './department.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Department, DepartmentSchema } from '../../schemas/department.schema';
import { MembersModule } from '../members/members.module';
import { AdminModule } from '../admin/admin.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Department.name, schema: DepartmentSchema },
    ]),
    MembersModule,
    AdminModule,
    ActivityLogModule,
    NotificationModule,
  ],
  controllers: [DepartmentController],
  providers: [DepartmentService],
  exports: [DepartmentService],
})
export class DepartmentModule {}
