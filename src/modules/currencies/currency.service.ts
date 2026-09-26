import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Currency } from '../../schemas/currency.schema';
import { GivingBatch } from '../../schemas/giving-batch.schema';
import { GivingEntry } from '../../schemas/giving-entry.schema';
import { ChurchService } from '../church/church.service';

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  GBP: '£',
  EUR: '€',
  GHS: 'GH₵',
  KES: 'KSh',
  ZAR: 'R',
};

@Injectable()
export class CurrencyService {
  constructor(
    @InjectModel(Currency.name) private currencyModel: Model<Currency>,
    @InjectModel(GivingBatch.name)
    private givingBatchModel: Model<GivingBatch>,
    @InjectModel(GivingEntry.name)
    private givingEntryModel: Model<GivingEntry>,
    private churchService: ChurchService,
  ) {}

  async seedDefault(churchId: Types.ObjectId, code: string) {
    return this.currencyModel.create({
      churchId,
      code,
      symbol: CURRENCY_SYMBOLS[code] || code,
      name: code,
      isDefault: true,
      isActive: true,
    });
  }

  async findAll(tenant: TenantContext) {
    const existingCount = await this.currencyModel.countDocuments({
      churchId: tenant.churchId,
    });

    if (existingCount === 0) {
      const church = await this.churchService.findById(tenant.churchId);
      await this.seedDefault(tenant.churchId, church?.defaultCurrency || 'NGN');
    }

    return this.currencyModel
      .find({ churchId: tenant.churchId })
      .sort({ isDefault: -1, code: 1 })
      .lean();
  }

  async create(
    tenant: TenantContext,
    dto: { code: string; symbol: string; name: string; isActive?: boolean },
  ) {
    return this.currencyModel.create({
      churchId: tenant.churchId,
      code: dto.code,
      symbol: dto.symbol,
      name: dto.name,
      isActive: dto.isActive ?? true,
      isDefault: false,
    });
  }

  async update(
    tenant: TenantContext,
    id: string,
    dto: { code?: string; symbol?: string; name?: string; isActive?: boolean },
  ) {
    const currency = await this.currencyModel.findOne({
      _id: id,
      churchId: tenant.churchId,
    });

    if (!currency) {
      throw new NotFoundException('Currency not found');
    }

    if (dto.code !== undefined) {
      currency.code = dto.code;
    }
    if (dto.symbol !== undefined) {
      currency.symbol = dto.symbol;
    }
    if (dto.name !== undefined) {
      currency.name = dto.name;
    }
    if (dto.isActive !== undefined) {
      currency.isActive = dto.isActive;
    }

    await currency.save();
    return currency;
  }

  async setDefault(tenant: TenantContext, id: string) {
    const currency = await this.currencyModel.findOne({
      _id: id,
      churchId: tenant.churchId,
    });

    if (!currency) {
      throw new NotFoundException('Currency not found');
    }

    await this.currencyModel.updateMany(
      { churchId: tenant.churchId },
      { isDefault: false },
    );

    currency.isDefault = true;
    currency.isActive = true;
    await currency.save();
    return currency;
  }

  async hasDefault(tenant: TenantContext) {
    const count = await this.currencyModel.countDocuments({
      churchId: tenant.churchId,
      isDefault: true,
    });
    return count > 0;
  }

  async remove(tenant: TenantContext, id: string) {
    const currency = await this.currencyModel.findOne({
      _id: id,
      churchId: tenant.churchId,
    });

    if (!currency) {
      throw new NotFoundException('Currency not found');
    }

    // Entries reference a currency by its string code (not id) and don't
    // Store churchId, so the in-use check is scoped to this church's own
    // Batches to avoid over-blocking on a code another church also uses.
    const batchIds = await this.givingBatchModel
      .find({ churchId: tenant.churchId })
      .distinct('_id');
    const inUse = await this.givingEntryModel.exists({
      batchId: { $in: batchIds },
      currencyCode: currency.code,
    });
    if (inUse) {
      throw new BadRequestException(
        'This currency is used by existing giving records and cannot be deleted. Deactivate it instead.',
      );
    }

    await this.currencyModel.deleteOne({
      _id: id,
      churchId: tenant.churchId,
    });

    return { message: 'Currency deleted' };
  }
}
