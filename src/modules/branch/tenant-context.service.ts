import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AdminAccessScope } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { AdminBranchAccess } from '../../schemas/admin-branch-access.schema';
import { Branch } from '../../schemas/branch.schema';

/**
 * Resolves which branches an admin can act in, and which one is "active"
 * for the current request. This is the one place that knows how
 * accessScope (BRANCH vs ORG_WIDE) translates into an actual list of
 * branch ids - everything else (JwtStrategy, controllers) just asks it.
 */
@Injectable()
export class TenantContextService {
  constructor(
    @InjectModel(Branch.name) private branchModel: Model<Branch>,
    @InjectModel(AdminBranchAccess.name)
    private adminBranchAccessModel: Model<AdminBranchAccess>,
  ) {}

  async resolveAccessibleBranchIds(
    admin: Pick<Admin, '_id' | 'churchId' | 'accessScope'>,
  ): Promise<Types.ObjectId[]> {
    if (admin.accessScope === AdminAccessScope.ORG_WIDE) {
      const branches = await this.branchModel
        .find({ churchId: admin.churchId, isActive: true })
        .select('_id')
        .lean();

      return branches.map((branch) => branch._id as Types.ObjectId);
    }

    const grants = await this.adminBranchAccessModel
      .find({ adminId: admin._id })
      .select('branchId')
      .lean();

    return grants.map((grant) => grant.branchId as Types.ObjectId);
  }

  async resolveTenantContext(
    admin: Pick<Admin, '_id' | 'churchId' | 'accessScope' | 'defaultBranchId'>,
    requestedBranchId?: string | null,
  ): Promise<TenantContext> {
    const accessibleBranchIds = await this.resolveAccessibleBranchIds(admin);
    const accessibleIdStrings = accessibleBranchIds.map((id) => id.toString());

    let branchId: Types.ObjectId | null = null;

    if (requestedBranchId && accessibleIdStrings.includes(requestedBranchId)) {
      branchId =
        accessibleBranchIds.find((id) => id.toString() === requestedBranchId) ||
        null;
    } else if (
      admin.defaultBranchId &&
      accessibleIdStrings.includes(admin.defaultBranchId.toString())
    ) {
      branchId = admin.defaultBranchId as Types.ObjectId;
    } else if (accessibleBranchIds.length === 1) {
      branchId = accessibleBranchIds[0];
    }

    return {
      churchId: admin.churchId,
      branchId,
      accessScope: admin.accessScope,
      accessibleBranchIds,
    };
  }

  async hasAccessToBranch(
    admin: Pick<Admin, '_id' | 'churchId' | 'accessScope'>,
    branchId: string,
  ): Promise<boolean> {
    const accessibleBranchIds = await this.resolveAccessibleBranchIds(admin);
    return accessibleBranchIds.some((id) => id.toString() === branchId);
  }
}
