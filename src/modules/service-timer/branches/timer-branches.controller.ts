import { IsString, MaxLength, MinLength } from 'class-validator';

import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantContext } from '../../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../../common/utils/enums.utils';
import { Admin } from '../../../schemas/admin.schema';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { BranchService } from '../../branch/branch.service';
import { TimerPlanService } from '../billing/timer-plan.service';

export class CreateTimerBranchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name: string;
}

/**
 * Branches for the Service Timer (Church plan: several branches, each with
 * its own timer). Branches are Church Workflow's own, so a church using both
 * products sees the same list; only the limit differs: timer-only churches
 * get their timer plan's limit, Church Workflow churches keep theirs.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('service-timer/branches')
export class TimerBranchesController {
  constructor(
    private readonly branches: BranchService,
    private readonly plans: TimerPlanService,
  ) {}

  @Get()
  @RequirePermissions({
    section: ModuleSections.SERVICE_TIMER,
    level: AccessLevel.VIEW,
  })
  async list(@CurrentTenant() tenant: TenantContext) {
    const [mine, plan, count] = await Promise.all([
      this.branches.listForTenant(tenant),
      this.plans.planFor(tenant.churchId),
      this.branches.countActive(tenant.churchId),
    ]);
    return {
      branches: mine.branches.map((b) => ({
        id: String(b._id),
        name: b.name,
        isHQ: !!b.isHQ,
      })),
      activeBranchId: mine.activeBranchId,
      accessScope: mine.accessScope,
      // null: Church Workflow's own limits apply (managed there).
      limit: plan.branchLimit,
      count,
    };
  }

  @Post()
  @RequirePermissions({
    section: ModuleSections.SERVICE_TIMER,
    level: AccessLevel.FULL_ACCESS,
  })
  async create(@AuthUser() admin: Admin, @Body() dto: CreateTimerBranchDto) {
    const plan = await this.plans.planFor(admin.churchId);
    const limit =
      plan.branchLimit === null
        ? undefined
        : {
            max: plan.branchLimit,
            message:
              plan.key === 'FREE'
                ? 'More branches are part of the Church plan.'
                : `Your plan includes ${plan.branchLimit} branches.`,
          };
    const branch = await this.branches.create(admin, { name: dto.name }, limit);
    return { id: String(branch._id), name: branch.name, isHQ: !!branch.isHQ };
  }
}
