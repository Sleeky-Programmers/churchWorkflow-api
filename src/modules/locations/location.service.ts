import { Model } from 'mongoose';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { paginationMeta } from '../../common/helpers/pagination.helper';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AdminAccessScope } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { Location } from '../../schemas/location.schema';

@Injectable()
export class LocationService {
  constructor(
    @InjectModel(Location.name)
    private locationModel: Model<Location>,
  ) {}

  private assertOrgWide(authUser: Admin) {
    if (authUser.accessScope !== AdminAccessScope.ORG_WIDE) {
      throw new ForbiddenException('Only org-wide admins can manage locations');
    }
  }

  // Church-wide: locations are shared by all branches, so this is keyed by
  // ChurchId only — never branchId. No default seeding — unlike titles,
  // There's no sensible universal list of auditorium names.
  async findAll(
    tenant: TenantContext,
    pagination?: { page: number; limit: number },
  ) {
    const query = this.locationModel
      .find({ churchId: tenant.churchId })
      .sort({ sortOrder: 1, name: 1 });

    if (!pagination) {
      return query.lean();
    }

    const itemCount = await this.locationModel.countDocuments({
      churchId: tenant.churchId,
    });
    const data = await query
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean();

    return {
      data,
      pagination: paginationMeta({ ...pagination, itemCount }),
    };
  }

  async create(
    authUser: Admin,
    dto: { name: string; isActive?: boolean; sortOrder?: number },
  ) {
    this.assertOrgWide(authUser);

    return this.locationModel.create({
      churchId: authUser.churchId,
      name: dto.name,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
      isSystem: false,
    });
  }

  async update(
    authUser: Admin,
    id: string,
    dto: { name?: string; isActive?: boolean; sortOrder?: number },
  ) {
    this.assertOrgWide(authUser);

    const location = await this.locationModel.findOne({
      _id: id,
      churchId: authUser.churchId,
    });

    if (!location) {
      throw new NotFoundException('Location not found');
    }

    if (dto.name !== undefined) {
      location.name = dto.name;
    }
    if (dto.isActive !== undefined) {
      location.isActive = dto.isActive;
    }
    if (dto.sortOrder !== undefined) {
      location.sortOrder = dto.sortOrder;
    }

    await location.save();
    return location;
  }

  async remove(authUser: Admin, id: string) {
    this.assertOrgWide(authUser);

    const location = await this.locationModel.findOne({
      _id: id,
      churchId: authUser.churchId,
    });
    if (!location) {
      throw new NotFoundException('Location not found');
    }

    await this.locationModel.deleteOne({
      _id: id,
      churchId: authUser.churchId,
    });

    return { message: 'Location deleted' };
  }
}
