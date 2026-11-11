import { forwardRef, Module } from '@nestjs/common';
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
import {
  OfferingType,
  OfferingTypeSchema,
} from '../../schemas/offering-type.schema';
import { ChurchModule } from '../church/church.module';
import { FlutterwaveModule } from '../flutterwave/flutterwave.module';
import { PaystackModule } from '../paystack/paystack.module';
import { OnlineGivingController } from './online-giving.controller';
import { OnlineGivingService } from './online-giving.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OfferingType.name, schema: OfferingTypeSchema },
      { name: Currency.name, schema: CurrencySchema },
      { name: GivingBatch.name, schema: GivingBatchSchema },
      { name: GivingEntry.name, schema: GivingEntrySchema },
    ]),
    forwardRef(() => {
      return ChurchModule;
    }),
    forwardRef(() => {
      return PaystackModule;
    }),
    forwardRef(() => {
      return FlutterwaveModule;
    }),
  ],
  controllers: [OnlineGivingController],
  providers: [OnlineGivingService],
  exports: [OnlineGivingService],
})
export class OnlineGivingModule {}
