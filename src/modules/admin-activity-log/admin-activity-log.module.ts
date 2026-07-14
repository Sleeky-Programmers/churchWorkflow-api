import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminActivityLogService } from './admin-activity-log.service';
import { AdminActivityLogController } from './admin-activity-log.controller';
import {
  AdminActivityLog,
  AdminActivityLogSchema,
} from '../../schemas/admin-activity-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AdminActivityLog.name, schema: AdminActivityLogSchema },
    ]),
  ],
  controllers: [AdminActivityLogController],
  providers: [AdminActivityLogService],
  exports: [AdminActivityLogService],
})
export class AdminActivityLogModule {}
