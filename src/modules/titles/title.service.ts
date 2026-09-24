import { Model, Types } from 'mongoose';

import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { paginationMeta } from '../../common/helpers/pagination.helper';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import {
  AdminAccessScope,
  Gender,
  MemberTitle,
} from '../../common/utils/enums.utils';
import { TITLE_CATEGORIES } from '../../common/utils/titles.constant';
import { Admin } from '../../schemas/admin.schema';
import { Member } from '../../schemas/member.schema';
import { Title } from '../../schemas/title.schema';

export const DEFAULT_TITLES = Object.values(TITLE_CATEGORIES).flat();

@Injectable()
export class TitleService {
  constructor(
    @InjectModel(Title.name)
    private titleModel: Model<Title>,
    @InjectModel(Member.name)
    private memberModel: Model<Member>,
  ) {}

  private assertOrgWide(authUser: Admin) {
    if (authUser.accessScope !== AdminAccessScope.ORG_WIDE) {
      throw new ForbiddenException('Only org-wide admins can manage titles');
    }
  }

  async seedDefaults(churchId: Types.ObjectId) {
    return this.titleModel.insertMany(
      DEFAULT_TITLES.map((name, index) => ({
        churchId,
        name,
        isActive: true,
        sortOrder: index,
        isSystem: true,
      })),
    );
  }

  // Church-wide: titles are shared by all branches, so this is keyed by
  // ChurchId only — never branchId, unlike branch-scoped resources.
  async findAll(
    tenant: TenantContext,
    pagination?: { page: number; limit: number },
  ) {
    const existingCount = await this.titleModel.countDocuments({
      churchId: tenant.churchId,
    });

    if (existingCount === 0) {
      await this.seedDefaults(tenant.churchId);
    }

    const query = this.titleModel
      .find({ churchId: tenant.churchId })
      .sort({ sortOrder: 1, name: 1 });

    if (!pagination) {
      return query.lean();
    }

    const itemCount = await this.titleModel.countDocuments({
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

    return this.titleModel.create({
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

    const title = await this.titleModel.findOne({
      _id: id,
      churchId: authUser.churchId,
    });

    if (!title) {
      throw new NotFoundException('Title not found');
    }

    if (dto.name !== undefined) {
      title.name = dto.name;
    }
    if (dto.isActive !== undefined) {
      title.isActive = dto.isActive;
    }
    if (dto.sortOrder !== undefined) {
      title.sortOrder = dto.sortOrder;
    }

    await title.save();
    return title;
  }

  async remove(authUser: Admin, id: string) {
    this.assertOrgWide(authUser);

    const title = await this.titleModel.findOne({
      _id: id,
      churchId: authUser.churchId,
    });
    if (!title) {
      throw new NotFoundException('Title not found');
    }

    await Promise.all([
      this.memberModel.updateMany(
        {
          churchId: authUser.churchId,
          title: title.name,
          gender: Gender.MALE,
        },
        { $set: { title: MemberTitle.MR } },
      ),
      this.memberModel.updateMany(
        {
          churchId: authUser.churchId,
          title: title.name,
          gender: Gender.FEMALE,
        },
        { $set: { title: MemberTitle.MISS } },
      ),
    ]);

    await this.titleModel.deleteOne({
      _id: id,
      churchId: authUser.churchId,
    });

    return { message: 'Title deleted' };
  }
}
