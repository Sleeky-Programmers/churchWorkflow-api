import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Asset, AssetSchema } from '../../schemas/asset.schema';
import { AssetHistory, AssetHistorySchema } from '../../schemas/asset-history.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AdminModule } from '../admin/admin.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { AssetManagementController } from './asset-management.controller';
import { AssetManagementService } from './asset-management.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Asset.name, schema: AssetSchema },
      { name: AssetHistory.name, schema: AssetHistorySchema },
    ]),
    FileUploadModule,
    ActivityLogModule,
    AdminModule,
  ],
  controllers: [AssetManagementController],
  providers: [AssetManagementService],
  exports: [AssetManagementService],
})
export class AssetManagementModule {}
