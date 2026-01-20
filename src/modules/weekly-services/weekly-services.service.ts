import { CreateWeeklyServiceDto } from './dto/create-weekly-service.dto';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { WeeklyService } from '../../schemas/weekly-service.schema';
import { Model } from 'mongoose';

@Injectable()
export class WeeklyServicesService {
  constructor(
    @InjectModel(WeeklyService.name)
    private weeklyServiceModel: Model<WeeklyService>,
  ) {}

  async create(createWeeklyServiceDto: CreateWeeklyServiceDto) {
    return await this.weeklyServiceModel.create(createWeeklyServiceDto);
  }

  async delete(id: string) {
    return await this.weeklyServiceModel.findByIdAndDelete(id);
  }
}
