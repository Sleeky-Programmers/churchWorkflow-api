import { BadRequestException } from '@nestjs/common';
import { FilterQuery } from 'mongoose';
import { TenantContext } from '../interfaces/tenant-context.interface';

/**
 * Single source of truth for turning a resolved TenantContext into a Mongoose
 * filter. Services should call this instead of hand-writing
 * `{ churchId: authUser.churchId }` filters, so branch scoping lives in one
 * place rather than being copy-pasted at every call site.
 */
export function buildTenantFilter(
  tenant: TenantContext,
  opts?: { allBranches?: boolean },
): FilterQuery<{ churchId: unknown; branchId: unknown }> {
  if (opts?.allBranches) {
    return {
      churchId: tenant.churchId,
      branchId: { $in: tenant.accessibleBranchIds },
    };
  }

  if (!tenant.branchId) {
    throw new BadRequestException(
      'No active branch selected. Switch to a branch and try again.',
    );
  }

  return { churchId: tenant.churchId, branchId: tenant.branchId };
}
