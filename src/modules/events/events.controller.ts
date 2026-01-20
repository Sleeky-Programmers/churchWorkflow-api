import {
  Body,
  Controller,
  Delete,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { EventsService } from './events.service';
import { WeeklyServicesService } from '../weekly-services/weekly-services.service';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CreateWeeklyServiceDto } from '../weekly-services/dto/create-weekly-service.dto';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly weeklyServicesService: WeeklyServicesService,
  ) {}

  @Post('weekly-service/create')
  createWeeklyService(@Body() createWeeklyServiceDto: CreateWeeklyServiceDto) {
    return this.weeklyServicesService.create(createWeeklyServiceDto);
  }

  @Delete('weekly-service/delete/:id')
  deleteWeeklyService(@Param('id') id: string) {
    return this.weeklyServicesService.delete(id);
  }
}
