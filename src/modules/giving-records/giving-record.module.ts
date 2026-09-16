import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  GivingRecord,
  GivingRecordSchema,
} from '../../schemas/giving-record.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { ChurchModule } from '../church/church.module';
import { GivingRecordController } from './giving-record.controller';
import { GivingRecordService } from './giving-record.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GivingRecord.name, schema: GivingRecordSchema },
    ]),
    ChurchModule,
    ActivityLogModule,
  ],
  controllers: [GivingRecordController],
  providers: [GivingRecordService],
  exports: [GivingRecordService],
})
export class GivingRecordModule {}
