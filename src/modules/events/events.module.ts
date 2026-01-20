import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { WeeklyServicesModule } from '../weekly-services/weekly-services.module';

@Module({
  imports: [WeeklyServicesModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
