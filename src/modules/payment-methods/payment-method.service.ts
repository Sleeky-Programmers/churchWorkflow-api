import { Model } from 'mongoose';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { GivingBatch } from '../../schemas/giving-batch.schema';
import {
  GivingEntry,
  GivingEntryPaymentMethod,
} from '../../schemas/giving-entry.schema';
import { PaymentMethod } from '../../schemas/payment-method.schema';

// Class-validator's @IsEnum checks membership against the enum's *values*
// (e.g. 'Cash'), not its keys (e.g. 'CASH') - so the enum's own values are
// Used as the canonical preset code, avoiding the key/value mismatch that
// Previously existed between this enum and the frontend's hardcoded list.
export const PAYMENT_METHOD_PRESETS = Object.values(
  GivingEntryPaymentMethod,
).map((value) => {
  return {
    code: value,
    name: value,
  };
});

@Injectable()
export class PaymentMethodService {
  constructor(
    @InjectModel(PaymentMethod.name)
    private paymentMethodModel: Model<PaymentMethod>,
    @InjectModel(GivingBatch.name)
    private givingBatchModel: Model<GivingBatch>,
    @InjectModel(GivingEntry.name)
    private givingEntryModel: Model<GivingEntry>,
  ) {}

  getPresets() {
    return PAYMENT_METHOD_PRESETS;
  }

  async findAll(tenant: TenantContext) {
    const filter = { churchId: tenant.churchId };

    // A church that has never configured payment methods would otherwise get
    // An empty dropdown on the giving form, so seed the presets on first read.
    // Creates data only (no schema change); unique-index races are ignored.
    const count = await this.paymentMethodModel.countDocuments(filter);
    if (count === 0) {
      try {
        await this.paymentMethodModel.insertMany(
          PAYMENT_METHOD_PRESETS.map((preset, index) => {
            return {
              churchId: tenant.churchId,
              code: preset.code,
              name: preset.name,
              isActive: true,
              sortOrder: index,
            };
          }),
          { ordered: false },
        );
      } catch {
        // Concurrent first-load already seeded them.
      }
    }

    return this.paymentMethodModel
      .find(filter)
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }

  async hasActive(tenant: TenantContext) {
    const count = await this.paymentMethodModel.countDocuments({
      churchId: tenant.churchId,
      isActive: true,
    });
    return count > 0;
  }

  async create(
    tenant: TenantContext,
    dto: {
      code: GivingEntryPaymentMethod;
      isActive?: boolean;
      sortOrder?: number;
    },
  ) {
    const preset = PAYMENT_METHOD_PRESETS.find((p) => {
      return p.code === dto.code;
    });
    if (!preset) {
      throw new BadRequestException('Unknown payment method preset');
    }

    const existing = await this.paymentMethodModel.findOne({
      churchId: tenant.churchId,
      code: dto.code,
    });
    if (existing) {
      throw new BadRequestException(
        'This payment method has already been added',
      );
    }

    const count = await this.paymentMethodModel.countDocuments({
      churchId: tenant.churchId,
    });

    return this.paymentMethodModel.create({
      churchId: tenant.churchId,
      code: dto.code,
      name: preset.name,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? count,
    });
  }

  async update(
    tenant: TenantContext,
    id: string,
    dto: { isActive?: boolean; sortOrder?: number },
  ) {
    const paymentMethod = await this.paymentMethodModel.findOne({
      _id: id,
      churchId: tenant.churchId,
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    if (dto.isActive !== undefined) {
      paymentMethod.isActive = dto.isActive;
    }
    if (dto.sortOrder !== undefined) {
      paymentMethod.sortOrder = dto.sortOrder;
    }

    await paymentMethod.save();
    return paymentMethod;
  }

  async remove(tenant: TenantContext, id: string) {
    const paymentMethod = await this.paymentMethodModel.findOne({
      _id: id,
      churchId: tenant.churchId,
    });

    if (!paymentMethod) {
      throw new NotFoundException('Payment method not found');
    }

    // Entries store the payment method as the enum value (e.g. 'Cash'),
    // Which matches PaymentMethod.code. Scope the in-use check to this
    // Church's own batches since entries don't carry churchId.
    const batchIds = await this.givingBatchModel
      .find({ churchId: tenant.churchId })
      .distinct('_id');
    const inUse = await this.givingEntryModel.exists({
      batchId: { $in: batchIds },
      paymentMethod: paymentMethod.code,
    });
    if (inUse) {
      throw new BadRequestException(
        'This payment method is used by existing giving records and cannot be deleted. Deactivate it instead.',
      );
    }

    await this.paymentMethodModel.deleteOne({
      _id: id,
      churchId: tenant.churchId,
    });

    return { message: 'Payment method deleted' };
  }
}
