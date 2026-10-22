/* eslint-disable no-console */
// Standalone one-off migration script - not wired into app bootstrap.
// Run with: npm run migrate:backfill-asset-units
//
// Gives every existing asset that has no per-item `units` yet one unit for
// Each item counted in its old condition breakdown (for example
// "good: 2, damaged: 1" becomes three units). qty, conditions and condition
// Are left exactly as they are. Safe to run more than once: assets that
// Already have units are skipped.
//
// The app also derives these units on the fly while reading, so running this
// Is what makes them permanent (and lets you add serials/notes to them).
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AppModule } from '../app.module';
import { AssetCondition } from '../common/utils/enums.utils';
import { Asset } from '../schemas/asset.schema';

const DRY_RUN = process.argv.includes('--dry-run');

function newUnitId() {
  return `U-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const assetModel = app.get<Model<Asset>>(getModelToken(Asset.name));

    const assets = await assetModel
      .find({ $or: [{ units: { $exists: false } }, { units: { $size: 0 } }] })
      .select('_id name conditions createdAt')
      .lean();

    console.log(
      `${DRY_RUN ? '[dry run] ' : ''}Found ${assets.length} assets without units`,
    );

    let updated = 0;
    for (const asset of assets as any[]) {
      const c = asset.conditions || {};
      const order: [AssetCondition, number][] = [
        [AssetCondition.GOOD, c.good || 0],
        [AssetCondition.FAIR, c.fair || 0],
        [AssetCondition.REPAIR, c.repair || 0],
        [AssetCondition.DAMAGED, c.damaged || 0],
      ];

      const units = order.flatMap(([condition, count]) =>
        Array.from({ length: count }, () => ({
          unitId: newUnitId(),
          serial: '',
          condition,
          conditionNote: '',
          purchaseDate: null,
          value: null,
          addedAt: asset.createdAt ?? new Date(),
        })),
      );

      if (!units.length) {
        console.warn(
          `Skipping "${asset.name}" (${asset._id}): no items counted`,
        );
        continue;
      }

      if (!DRY_RUN) {
        await assetModel.updateOne({ _id: asset._id }, { $set: { units } });
      }
      updated += 1;
    }

    console.log(
      `${DRY_RUN ? '[dry run] Would update' : 'Updated'} ${updated} assets`,
    );
  } finally {
    await app.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
