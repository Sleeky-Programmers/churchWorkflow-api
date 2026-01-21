import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WeeklyServicesService } from './weekly-services.service';
import { WeeklyServicesController } from './weekly-services.controller';
import {
  WeeklyService,
  WeeklyServiceSchema,
} from '../../schemas/weekly-service.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WeeklyService.name, schema: WeeklyServiceSchema },
    ]),
  ],
  controllers: [WeeklyServicesController],
  providers: [WeeklyServicesService],
  exports: [WeeklyServicesService],
})
export class WeeklyServicesModule {}
