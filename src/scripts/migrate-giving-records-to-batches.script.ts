/* eslint-disable no-console */
// Standalone one-off migration script - not wired into app bootstrap.
// Run with: npm run migrate:giving-records-to-batches
//
// Reads every legacy `giving_records` document and, for each one, creates a
// Confirmed GivingBatch plus up to 4 GivingEntry rows (one per non-zero
// Legacy field: tithe/offering/specialOffering/thanksgivingOffering),
// Mapped to the church's seeded system OfferingType by name. The old
// `giving_records` collection is left untouched as a safety net.
import { NestFactory } from '@nestjs/core';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AppModule } from '../app.module';
import { OfferingTypeService } from '../modules/offering-types/offering-type.service';
import {
  GivingBatch,
  GivingBatchSource,
  GivingBatchStatus,
} from '../schemas/giving-batch.schema';
import {
  GivingEntry,
  GivingEntryPaymentMethod,
} from '../schemas/giving-entry.schema';
import { OfferingType } from '../schemas/offering-type.schema';

const FIELD_TO_OFFERING_NAME: Record<string, string> = {
  tithe: 'Tithe',
  offering: 'Offering',
  specialOffering: 'Special Offering',
  thanksgivingOffering: 'Thanksgiving Offering',
};

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const connection = app.get(getConnectionToken());
    const givingBatchModel = app.get<Model<GivingBatch>>(
      getModelToken(GivingBatch.name),
    );
    const givingEntryModel = app.get<Model<GivingEntry>>(
      getModelToken(GivingEntry.name),
    );
    const offeringTypeModel = app.get<Model<OfferingType>>(
      getModelToken(OfferingType.name),
    );
    const offeringTypeService = app.get(OfferingTypeService);

    const legacyRecords = await connection
      .collection('giving_records')
      .find({})
      .toArray();

    console.log(`Found ${legacyRecords.length} legacy giving records`);

    // ChurchId -> (offering type name -> offeringTypeId)
    const offeringTypeCache = new Map<string, Map<string, Types.ObjectId>>();

    let batchesCreated = 0;
    let entriesCreated = 0;
    let skipped = 0;
    const errors: { recordId: string; error: string }[] = [];

    for (const record of legacyRecords) {
      try {
        const churchId: Types.ObjectId = record.churchId;
        if (!churchId || !record.churchServiceId || !record.date) {
          skipped += 1;
          continue;
        }

        const churchKey = churchId.toString();
        let nameToId = offeringTypeCache.get(churchKey);
        if (!nameToId) {
          let types = await offeringTypeModel.find({ churchId }).lean();
          if (types.length === 0) {
            await offeringTypeService.seedDefaults(churchId);
            types = await offeringTypeModel.find({ churchId }).lean();
          }
          nameToId = new Map(
            types.map((t) => {
              return [t.name, t._id as Types.ObjectId];
            }),
          );
          offeringTypeCache.set(churchKey, nameToId);
        }

        const alreadyMigrated = await givingBatchModel.findOne({
          churchServiceId: record.churchServiceId,
          date: record.date,
        });
        if (alreadyMigrated) {
          skipped += 1;
          continue;
        }

        const nonZeroFields = Object.entries(FIELD_TO_OFFERING_NAME).filter(
          ([field]) => {
            return (record[field] || 0) > 0;
          },
        );
        if (nonZeroFields.length === 0) {
          skipped += 1;
          continue;
        }

        const totalAmount =
          record.totalAmount ||
          nonZeroFields.reduce((sum, [field]) => {
            return sum + (record[field] || 0);
          }, 0);

        const batch = await givingBatchModel.create({
          churchId,
          branchId: record.branchId || null,
          churchServiceId: record.churchServiceId,
          date: record.date,
          status: GivingBatchStatus.CONFIRMED,
          source: GivingBatchSource.MANUAL,
          recordedBy: record.recordedBy || null,
          confirmedBy: record.recordedBy || null,
          confirmedAt: record.updatedAt || record.createdAt || new Date(),
          totalAmount,
        });
        batchesCreated += 1;

        for (const [field, offeringTypeName] of nonZeroFields) {
          const offeringTypeId = nameToId.get(offeringTypeName);
          if (!offeringTypeId) {
            continue;
          }

          await givingEntryModel.create({
            batchId: batch._id,
            offeringTypeId,
            currencyCode: record.currency || 'NGN',
            amount: record[field] || 0,
            paymentMethod: GivingEntryPaymentMethod.CASH,
          });
          entriesCreated += 1;
        }
      } catch (error: any) {
        skipped += 1;
        errors.push({
          recordId: record._id?.toString?.() || 'unknown',
          error: error?.message || String(error),
        });
      }
    }

    console.log('Migration complete');
    console.log(`  Batches created: ${batchesCreated}`);
    console.log(`  Entries created: ${entriesCreated}`);
    console.log(`  Records skipped: ${skipped}`);
    if (errors.length > 0) {
      console.log(`  Errors (${errors.length}):`);
      console.log(JSON.stringify(errors, null, 2));
    }
  } finally {
    await app.close();
  }
}

run()
  .then(() => {
    return process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed', error);
    process.exit(1);
  });
