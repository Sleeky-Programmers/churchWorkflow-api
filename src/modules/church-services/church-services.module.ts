import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChurchServicesService } from './church-services.service';
import { ChurchServicesController } from './church-services.controller';
import {
  ChurchService,
  ChurchServiceSchema,
} from '../../schemas/church-service.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ChurchService.name, schema: ChurchServiceSchema },
    ]),
  ],
  controllers: [ChurchServicesController],
  providers: [ChurchServicesService],
  exports: [ChurchServicesService],
})
export class ChurchServicesModule {}
