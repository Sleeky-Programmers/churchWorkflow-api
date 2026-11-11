import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { paginationMeta } from '../../common/helpers/pagination.helper';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AdminAccessScope } from '../../common/utils/enums.utils';
import { AdminBranchAccess } from '../../schemas/admin-branch-access.schema';
import { Admin } from '../../schemas/admin.schema';
import { Branch } from '../../schemas/branch.schema';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateAdminAccessDto } from './dto/update-admin-access.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchService {
  constructor(
    @InjectModel(Branch.name) private branchModel: Model<Branch>,
    @InjectModel(AdminBranchAccess.name)
    private adminBranchAccessModel: Model<AdminBranchAccess>,
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
    private subscriptionService: SubscriptionService,
  ) {}

  private assertOrgWide(authUser: Admin) {
    if (authUser.accessScope !== AdminAccessScope.ORG_WIDE) {
      throw new ForbiddenException('Only org-wide admins can manage branches');
    }
  }

  // Branch names must be unique within a church (case-insensitive) so the
  // Branch switcher and management list stay unambiguous. Excludes a branch
  // Being updated from its own check.
  private async assertNameAvailable(
    churchId: Types.ObjectId,
    name: string,
    excludeBranchId?: Types.ObjectId | string,
  ) {
    // `_id` is only added when excluding a branch: `_id: undefined` would
    // match no document, so the check would never find a duplicate.
    const duplicate = await this.branchModel.findOne({
      churchId,
      ...(excludeBranchId ? { _id: { $ne: excludeBranchId } } : {}),
      name: {
        $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        $options: 'i',
      },
    });

    if (duplicate) {
      throw new BadRequestException(
        `A branch named "${name.trim()}" already exists in this church`,
      );
    }
  }

  async listForTenant(tenant: TenantContext) {
    const branches = await this.branchModel
      .find({ _id: { $in: tenant.accessibleBranchIds } })
      .sort({ isHQ: -1, createdAt: 1 })
      .lean();

    return {
      branches,
      accessScope: tenant.accessScope,
      activeBranchId: tenant.branchId?.toString() || null,
    };
  }

  // Used by the branch management settings page, not general tenant
  // Scoping - includes inactive branches, unlike listForTenant (whose
  // AccessibleBranchIds deliberately excludes them), so a deactivated
  // Branch stays visible with a "Reactivate" action instead of vanishing.
  async listAllForManagement(
    authUser: Admin,
    pagination?: { page: number; limit: number },
  ) {
    this.assertOrgWide(authUser);

    const query = this.branchModel
      .find({ churchId: authUser.churchId })
      .sort({ isHQ: -1, createdAt: 1 });

    if (!pagination) {
      return { branches: await query.lean() };
    }

    const itemCount = await this.branchModel.countDocuments({
      churchId: authUser.churchId,
    });
    const branches = await query
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean();

    return {
      branches,
      pagination: paginationMeta({ ...pagination, itemCount }),
    };
  }

  /**
   * `limit` lets another product (the Service Timer) apply its own branch
   * limit instead of the Church Workflow plan's; 0 means unlimited.
   */
  async create(
    authUser: Admin,
    dto: CreateBranchDto,
    limit?: { max: number; message: string },
  ) {
    this.assertOrgWide(authUser);

    const name = dto.name.trim();
    await this.assertNameAvailable(authUser.churchId, name);

    const currentBranchCount = await this.countActive(authUser.churchId);
    if (limit) {
      if (limit.max > 0 && currentBranchCount >= limit.max) {
        throw new ForbiddenException(limit.message);
      }
    } else {
      const limitCheck = await this.subscriptionService.checkBranchLimit(
        authUser.churchId,
        currentBranchCount,
      );
      if (!limitCheck.allowed) {
        throw new ForbiddenException(limitCheck.message);
      }
    }

    return this.branchModel.create({
      churchId: authUser.churchId,
      name,
      alias: dto.alias || null,
      address: dto.address || null,
      country: dto.country || null,
      state: dto.state || null,
      timeZone: dto.timeZone || null,
      isHQ: dto.isHQ || false,
      isActive: true,
    });
  }

  // System-initiated, not user-invoked - runs at church creation, before
  // The founding admin has any access scope to be checked against. Not
  // Gated by assertOrgWide for that reason.
  async createHQBranch(churchId: Types.ObjectId, name: string) {
    return this.branchModel.create({
      churchId,
      name: name.trim(),
      isHQ: true,
      isActive: true,
    });
  }

  async countActive(churchId: Types.ObjectId) {
    return this.branchModel.countDocuments({ churchId, isActive: true });
  }

  // Mirrors AdminInviteService.getUserLimitStatus's shape, so the frontend
  // Can drive the same LimitBanner component off either endpoint.
  async getBranchLimitStatus(authUser: Admin) {
    const currentBranches = await this.countActive(authUser.churchId);

    const subscription = await this.subscriptionService.getSubscription(
      authUser.churchId,
    );
    const plan = subscription.plan;
    const limit = await this.subscriptionService.getPlanBranchLimit(plan);

    const percentage = limit > 0 ? (currentBranches / limit) * 100 : 0;
    const isOverLimit = limit > 0 && currentBranches >= limit;
    const isNearLimit = limit > 0 && percentage >= 80 && !isOverLimit;

    return {
      currentBranches,
      limit,
      percentage: Math.min(percentage, 100),
      isOverLimit,
      isNearLimit,
      planName: plan,
    };
  }

  async update(authUser: Admin, branchId: string, dto: UpdateBranchDto) {
    this.assertOrgWide(authUser);

    const branch = await this.branchModel.findOne({
      _id: branchId,
      churchId: authUser.churchId,
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.isHQ && dto.isActive === false) {
      throw new BadRequestException('The head branch cannot be deactivated');
    }

    const updatePayload: Partial<Branch> = {};
    if (typeof dto.name === 'string') {
      const name = dto.name.trim();
      if (!name) {
        throw new BadRequestException('Branch name cannot be empty');
      }
      await this.assertNameAvailable(
        authUser.churchId,
        name,
        branch._id as Types.ObjectId,
      );
      updatePayload.name = name;
    }
    if (dto.alias !== undefined) {
      updatePayload.alias = dto.alias;
    }
    if (dto.address !== undefined) {
      updatePayload.address = dto.address;
    }
    if (dto.country !== undefined) {
      updatePayload.country = dto.country;
    }
    if (dto.state !== undefined) {
      updatePayload.state = dto.state;
    }
    if (dto.timeZone !== undefined) {
      updatePayload.timeZone = dto.timeZone;
    }
    if (dto.isHQ !== undefined) {
      updatePayload.isHQ = dto.isHQ;
    }
    if (dto.isActive !== undefined) {
      updatePayload.isActive = dto.isActive;
    }

    await this.branchModel.updateOne(
      { _id: branchId, churchId: authUser.churchId },
      updatePayload,
    );

    return this.branchModel.findById(branchId).lean();
  }

  async remove(authUser: Admin, branchId: string) {
    this.assertOrgWide(authUser);

    const branch = await this.branchModel.findOne({
      _id: branchId,
      churchId: authUser.churchId,
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (branch.isHQ) {
      throw new BadRequestException(
        'The Head Office branch was created automatically and cannot be deleted',
      );
    }

    await this.branchModel.deleteOne({ _id: branchId });
    await this.adminBranchAccessModel.deleteMany({ branchId });

    return { message: 'Branch deleted' };
  }

  async grantAccess(authUser: Admin, branchId: string, adminId: string) {
    this.assertOrgWide(authUser);

    const branch = await this.branchModel.findOne({
      _id: branchId,
      churchId: authUser.churchId,
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const targetAdmin = await this.adminModel.findOne({
      _id: adminId,
      churchId: authUser.churchId,
    });
    if (!targetAdmin) {
      throw new BadRequestException('Admin was not found in this church');
    }

    await this.adminBranchAccessModel.updateOne(
      { adminId, branchId },
      { $set: { adminId, branchId, churchId: authUser.churchId } },
      { upsert: true },
    );

    return { message: 'Branch access granted' };
  }

  /**
   * Gives a newly joined admin access to the branch they were invited to, and
   * makes it their default. Used by Service Timer invites: the timer has no
   * branch-access screen, so without this an invited operator could sign in
   * but never reach a timer.
   */
  async grantInvitedBranch(
    adminId: Types.ObjectId,
    churchId: Types.ObjectId,
    branchId: Types.ObjectId,
  ) {
    const branch = await this.branchModel.exists({ _id: branchId, churchId });
    if (!branch) {
      return;
    }
    await this.adminBranchAccessModel.updateOne(
      { adminId, branchId },
      { $set: { adminId, branchId, churchId } },
      { upsert: true },
    );
    await this.adminModel.updateOne(
      { _id: adminId, defaultBranchId: null },
      { $set: { defaultBranchId: branchId } },
    );
  }

  async revokeAccess(authUser: Admin, branchId: string, adminId: string) {
    this.assertOrgWide(authUser);

    const branch = await this.branchModel.findOne({
      _id: branchId,
      churchId: authUser.churchId,
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    await this.adminBranchAccessModel.deleteOne({ adminId, branchId });

    return { message: 'Branch access revoked' };
  }

  async listBranchAdmins(authUser: Admin, branchId: string) {
    this.assertOrgWide(authUser);

    const branch = await this.branchModel.findOne({
      _id: branchId,
      churchId: authUser.churchId,
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const grants = await this.adminBranchAccessModel
      .find({ branchId })
      .populate('adminId', 'firstName lastName email')
      .lean();

    return grants
      .filter((grant) => grant.adminId)
      .map((grant: any) => ({
        id: grant.adminId._id.toString(),
        firstName: grant.adminId.firstName,
        lastName: grant.adminId.lastName,
        email: grant.adminId.email,
      }));
  }

  async getAdminAccess(authUser: Admin, adminId: string) {
    this.assertOrgWide(authUser);

    const targetAdmin = await this.adminModel.findOne({
      _id: adminId,
      churchId: authUser.churchId,
    });
    if (!targetAdmin) {
      throw new BadRequestException('Admin was not found in this church');
    }

    const grants = await this.adminBranchAccessModel
      .find({ adminId })
      .select('branchId')
      .lean();

    return {
      accessScope: targetAdmin.accessScope,
      branchIds: grants.map((g) => g.branchId.toString()),
    };
  }

  // A church must always keep at least one org-wide admin, otherwise
  // Nobody could ever manage branches or access again (the exact bind
  // Self-service branch creation was built to get every church out of).
  private async assertKeepsAnOrgWideAdmin(
    churchId: Types.ObjectId,
    adminIdBeingChanged: Types.ObjectId,
    nextScope: AdminAccessScope,
  ) {
    if (nextScope === AdminAccessScope.ORG_WIDE) {
      return;
    }

    const otherOrgWideCount = await this.adminModel.countDocuments({
      churchId,
      accessScope: AdminAccessScope.ORG_WIDE,
      _id: { $ne: adminIdBeingChanged },
    });

    if (otherOrgWideCount === 0) {
      throw new BadRequestException(
        'This church must always have at least one org-wide admin - assign another admin org-wide access first',
      );
    }
  }

  async setAdminAccess(
    authUser: Admin,
    adminId: string,
    dto: UpdateAdminAccessDto,
  ) {
    this.assertOrgWide(authUser);

    const targetAdmin = await this.adminModel.findOne({
      _id: adminId,
      churchId: authUser.churchId,
    });
    if (!targetAdmin) {
      throw new BadRequestException('Admin was not found in this church');
    }

    await this.assertKeepsAnOrgWideAdmin(
      authUser.churchId,
      targetAdmin._id as Types.ObjectId,
      dto.accessScope,
    );

    if (dto.accessScope === AdminAccessScope.ORG_WIDE) {
      await Promise.all([
        this.adminModel.updateOne(
          { _id: adminId },
          { accessScope: AdminAccessScope.ORG_WIDE },
        ),
        this.adminBranchAccessModel.deleteMany({ adminId }),
      ]);

      return { accessScope: AdminAccessScope.ORG_WIDE, branchIds: [] };
    }

    const branchIds = dto.branchIds || [];
    if (branchIds.length) {
      const validBranchCount = await this.branchModel.countDocuments({
        _id: { $in: branchIds },
        churchId: authUser.churchId,
      });
      if (validBranchCount !== branchIds.length) {
        throw new BadRequestException(
          'One or more branches were not found in this church',
        );
      }
    }

    await this.adminModel.updateOne(
      { _id: adminId },
      { accessScope: AdminAccessScope.BRANCH },
    );

    await this.adminBranchAccessModel.deleteMany({ adminId });
    if (branchIds.length) {
      await this.adminBranchAccessModel.insertMany(
        branchIds.map((branchId) => ({
          adminId,
          branchId,
          churchId: authUser.churchId,
        })),
      );
    }

    return { accessScope: AdminAccessScope.BRANCH, branchIds };
  }

  async assertActiveInChurch(churchId: Types.ObjectId, branchId: string) {
    const branch = await this.branchModel.findOne({
      _id: branchId,
      churchId,
      isActive: true,
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }
}
