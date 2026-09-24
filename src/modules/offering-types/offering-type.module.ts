import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  OfferingType,
  OfferingTypeSchema,
} from '../../schemas/offering-type.schema';
import { OfferingTypeController } from './offering-type.controller';
import { OfferingTypeService } from './offering-type.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OfferingType.name, schema: OfferingTypeSchema },
    ]),
  ],
  controllers: [OfferingTypeController],
  providers: [OfferingTypeService],
  exports: [OfferingTypeService],
})
export class OfferingTypeModule {}
