import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  GivingBatch,
  GivingBatchSchema,
} from '../../schemas/giving-batch.schema';
import {
  GivingEntry,
  GivingEntrySchema,
} from '../../schemas/giving-entry.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { GivingBatchController } from './giving-batch.controller';
import { GivingBatchService } from './giving-batch.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GivingBatch.name, schema: GivingBatchSchema },
      { name: GivingEntry.name, schema: GivingEntrySchema },
    ]),
    ActivityLogModule,
  ],
  controllers: [GivingBatchController],
  providers: [GivingBatchService],
  exports: [GivingBatchService, MongooseModule],
})
export class GivingBatchModule {}
