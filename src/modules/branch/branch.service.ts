import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AdminAccessScope } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { AdminBranchAccess } from '../../schemas/admin-branch-access.schema';
import { Branch } from '../../schemas/branch.schema';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchService {
  constructor(
    @InjectModel(Branch.name) private branchModel: Model<Branch>,
    @InjectModel(AdminBranchAccess.name)
    private adminBranchAccessModel: Model<AdminBranchAccess>,
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
  ) {}

  private assertOrgWide(authUser: Admin) {
    if (authUser.accessScope !== AdminAccessScope.ORG_WIDE) {
      throw new ForbiddenException('Only org-wide admins can manage branches');
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

  async create(authUser: Admin, dto: CreateBranchDto) {
    this.assertOrgWide(authUser);

    return this.branchModel.create({
      churchId: authUser.churchId,
      name: dto.name.trim(),
      alias: dto.alias || null,
      address: dto.address || null,
      country: dto.country || null,
      state: dto.state || null,
      timeZone: dto.timeZone || null,
      isHQ: dto.isHQ || false,
      isActive: true,
    });
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

    const updatePayload: Partial<Branch> = {};
    if (typeof dto.name === 'string') {
      updatePayload.name = dto.name.trim();
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
