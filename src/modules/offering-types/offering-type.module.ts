import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  GivingEntry,
  GivingEntrySchema,
} from '../../schemas/giving-entry.schema';
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
      { name: GivingEntry.name, schema: GivingEntrySchema },
    ]),
  ],
  controllers: [OfferingTypeController],
  providers: [OfferingTypeService],
  exports: [OfferingTypeService],
})
export class OfferingTypeModule {}
