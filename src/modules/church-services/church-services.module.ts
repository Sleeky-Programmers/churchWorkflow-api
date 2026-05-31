import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChurchServicesService } from './church-services.service';
import { ChurchServicesScheduler } from './church-services.scheduler';
import { ChurchServicesController } from './church-services.controller';
import { ChurchServicesReminderScheduler } from './church-services.reminder.scheduler';
import { EmailModule } from '../email/email.module';
import { AdminModule } from '../admin/admin.module';
import {
  ChurchService,
  ChurchServiceSchema,
} from '../../schemas/church-service.schema';
import {
  ServiceInstance,
  ServiceInstanceSchema,
} from '../../schemas/service-instance.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChurchService.name, schema: ChurchServiceSchema },
      { name: ServiceInstance.name, schema: ServiceInstanceSchema },
    ]),
    EmailModule,
    forwardRef(() => AdminModule),
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
