import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Department, DepartmentSchema } from '../../schemas/department.schema';
import {
  Requisition,
  RequisitionSchema,
} from '../../schemas/requisition.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { ChurchModule } from '../church/church.module';
import { ExpenseModule } from '../expenses/expense.module';
import { NotificationModule } from '../notification/notification.module';
import { RequisitionController } from './requisition.controller';
import { RequisitionService } from './requisition.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Requisition.name, schema: RequisitionSchema },
      { name: Department.name, schema: DepartmentSchema },
    ]),
    ChurchModule,
    ExpenseModule,
    NotificationModule,
    ActivityLogModule,
  ],
  controllers: [RequisitionController],
  providers: [RequisitionService],
  exports: [RequisitionService],
})
export class RequisitionModule {}
