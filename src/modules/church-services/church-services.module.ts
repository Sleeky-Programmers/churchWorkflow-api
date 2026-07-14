import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  ChurchService,
  ChurchServiceSchema,
} from '../../schemas/church-service.schema';
import {
  ServiceInstance,
  ServiceInstanceSchema,
} from '../../schemas/service-instance.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AdminModule } from '../admin/admin.module';
import { EmailModule } from '../email/email.module';
import { ChurchServicesController } from './church-services.controller';
import { ChurchServicesReminderScheduler } from './church-services.reminder.scheduler';
import { ChurchServicesScheduler } from './church-services.scheduler';
import { ChurchServicesService } from './church-services.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChurchService.name, schema: ChurchServiceSchema },
      { name: ServiceInstance.name, schema: ServiceInstanceSchema },
    ]),
    EmailModule,
    forwardRef(() => AdminModule),
    forwardRef(() => ActivityLogModule),
    forwardRef(() => EmailModule),
  ],
  controllers: [ChurchServicesController],
  providers: [
    ChurchServicesService,
    ChurchServicesScheduler,
    ChurchServicesReminderScheduler,
  ],
  exports: [ChurchServicesService],
})
export class ChurchServicesModule {}
