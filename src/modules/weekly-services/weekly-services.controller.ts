import { Controller } from '@nestjs/common';
import { WeeklyServicesService } from './weekly-services.service';

@Controller('weekly-services')
export class WeeklyServicesController {
  constructor(private readonly weeklyServicesService: WeeklyServicesService) {}
}
