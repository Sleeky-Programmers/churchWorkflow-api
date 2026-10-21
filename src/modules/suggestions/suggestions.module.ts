import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Asset, AssetSchema } from '../../schemas/asset.schema';
import {
  GivingBatch,
  GivingBatchSchema,
} from '../../schemas/giving-batch.schema';
import {
  PastoralAlert,
  PastoralAlertSchema,
} from '../../schemas/pastoral-alert.schema';
import {
  Requisition,
  RequisitionSchema,
} from '../../schemas/requisition.schema';
import { UsageStat, UsageStatSchema } from '../../schemas/usage-stat.schema';
import { SuggestionsController } from './suggestions.controller';
import { SuggestionsService } from './suggestions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UsageStat.name, schema: UsageStatSchema },
      { name: Requisition.name, schema: RequisitionSchema },
      { name: GivingBatch.name, schema: GivingBatchSchema },
      { name: PastoralAlert.name, schema: PastoralAlertSchema },
      { name: Asset.name, schema: AssetSchema },
    ]),
  ],
  controllers: [SuggestionsController],
  providers: [SuggestionsService],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
