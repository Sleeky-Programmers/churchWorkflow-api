import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Currency, CurrencySchema } from '../../schemas/currency.schema';
import {
  GivingBatch,
  GivingBatchSchema,
} from '../../schemas/giving-batch.schema';
import {
  GivingEntry,
  GivingEntrySchema,
} from '../../schemas/giving-entry.schema';
import { ChurchModule } from '../church/church.module';
import { CurrencyController } from './currency.controller';
import { CurrencyService } from './currency.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Currency.name, schema: CurrencySchema },
      { name: GivingBatch.name, schema: GivingBatchSchema },
      { name: GivingEntry.name, schema: GivingEntrySchema },
    ]),
    ChurchModule,
  ],
  controllers: [CurrencyController],
  providers: [CurrencyService],
  exports: [CurrencyService],
})
export class CurrencyModule {}
