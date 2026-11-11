import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { GivingEntry } from '../../schemas/giving-entry.schema';
import { OfferingType } from '../../schemas/offering-type.schema';

export const DEFAULT_OFFERING_TYPES = [
  'Tithe',
  'Offering',
  'Special Offering',
  'Thanksgiving Offering',
  'Missions',
  'Building Fund',
  'Welfare',
  'Other',
];

@Injectable()
export class OfferingTypeService {
  constructor(
    @InjectModel(OfferingType.name)
    private offeringTypeModel: Model<OfferingType>,
    @InjectModel(GivingEntry.name)
    private givingEntryModel: Model<GivingEntry>,
  ) {}

  async seedDefaults(churchId: Types.ObjectId) {
    return this.offeringTypeModel.insertMany(
      DEFAULT_OFFERING_TYPES.map((name, index) => {
        return {
          churchId,
          name,
          isActive: true,
          sortOrder: index,
          isSystem: true,
        };
      }),
    );
  }

  async findAll(tenant: TenantContext) {
    const existingCount = await this.offeringTypeModel.countDocuments({
      churchId: tenant.churchId,
    });

    if (existingCount === 0) {
      await this.seedDefaults(tenant.churchId);
    }

    return this.offeringTypeModel
      .find({ churchId: tenant.churchId })
      .sort({ sortOrder: 1, name: 1 })
      .lean();
  }

  async create(
    tenant: TenantContext,
    dto: { name: string; isActive?: boolean; sortOrder?: number },
  ) {
    return this.offeringTypeModel.create({
      churchId: tenant.churchId,
      name: dto.name,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      isSystem: false,
    });
  }

  async update(
    tenant: TenantContext,
    id: string,
    dto: { name?: string; isActive?: boolean; sortOrder?: number },
  ) {
    const offeringType = await this.offeringTypeModel.findOne({
      _id: id,
      churchId: tenant.churchId,
    });

    if (!offeringType) {
      throw new NotFoundException('Offering type not found');
    }

    if (dto.name !== undefined) {
      offeringType.name = dto.name;
    }
    if (dto.isActive !== undefined) {
      offeringType.isActive = dto.isActive;
    }
    if (dto.sortOrder !== undefined) {
      offeringType.sortOrder = dto.sortOrder;
    }

    await offeringType.save();
    return offeringType;
  }

  async setDefault(tenant: TenantContext, id: string) {
    const offeringType = await this.offeringTypeModel.findOne({
      _id: id,
      churchId: tenant.churchId,
    });

    if (!offeringType) {
      throw new NotFoundException('Offering type not found');
    }

    await this.offeringTypeModel.updateMany(
      { churchId: tenant.churchId },
      { isDefault: false },
    );

    offeringType.isDefault = true;
    offeringType.isActive = true;
    await offeringType.save();
    return offeringType;
  }

  async hasDefault(tenant: TenantContext) {
    const count = await this.offeringTypeModel.countDocuments({
      churchId: tenant.churchId,
      isDefault: true,
    });
    return count > 0;
  }

  async remove(tenant: TenantContext, id: string) {
    const offeringType = await this.offeringTypeModel.findOne({
      _id: id,
      churchId: tenant.churchId,
    });

    if (!offeringType) {
      throw new NotFoundException('Offering type not found');
    }

    // OfferingTypeId is a globally-unique ObjectId, so a direct reference
    // Check across entries is safe without joining through batches.
    const inUse = await this.givingEntryModel.exists({
      offeringTypeId: new Types.ObjectId(id),
    });
    if (inUse) {
      throw new BadRequestException(
        'This offering type is used by existing giving records and cannot be deleted. Deactivate it instead.',
      );
    }

    await this.offeringTypeModel.deleteOne({
      _id: id,
      churchId: tenant.churchId,
    });

    return { message: 'Offering type deleted' };
  }
}
