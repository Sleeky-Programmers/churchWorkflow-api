import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Types } from 'mongoose';

import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AuthUser } from '../../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { TenantContext } from '../../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../../common/utils/enums.utils';
import { Admin } from '../../../schemas/admin.schema';
import {
  TimerBillingCycle,
  TimerPlan,
} from '../../../schemas/timer-billing.schema';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { ProductAdminJwtAuthGuard } from '../../product-admin/guard/product-jwt-auth.guard';
import { TimerBillingService } from './timer-billing.service';
import { TimerPlanService } from './timer-plan.service';

export class CheckoutDto {
  @IsEnum(TimerBillingCycle)
  cycle: TimerBillingCycle;
}

export class ConfirmDto {
  @IsString()
  @MaxLength(100)
  reference: string;
}

const FULL = {
  section: ModuleSections.SERVICE_TIMER,
  level: AccessLevel.FULL_ACCESS,
};

/** The church's plan, usage and payments (timer admins). */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions(FULL)
@Controller('service-timer/billing')
export class TimerBillingController {
  constructor(
    private readonly billing: TimerBillingService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  overview(@CurrentTenant() tenant: TenantContext) {
    return this.billing.overview(tenant.churchId);
  }

  /** Starts a Paystack payment; the app sends the payer to `authorizationUrl`. */
  @Post('checkout')
  checkout(@AuthUser() admin: Admin, @Body() dto: CheckoutDto) {
    const base = this.config.get<string>('TIMER_FRONTEND_URL');
    if (!base) {
      throw new ServiceUnavailableException(
        "Payments from the Service Timer aren't set up yet (TIMER_FRONTEND_URL).",
      );
    }
    return this.billing.checkout(
      admin,
      dto.cycle,
      `${base.replace(/\/$/, '')}/billing`,
    );
  }

  /** Called when the payer returns from Paystack with `?reference=`. */
  @Post('confirm')
  @HttpCode(200)
  confirm(@CurrentTenant() tenant: TenantContext, @Body() dto: ConfirmDto) {
    return this.billing.confirm(tenant.churchId, dto.reference);
  }
}

export class UpdatePlanDto {
  @IsOptional() @IsString() @MaxLength(40) name?: string;
  @IsOptional() @IsInt() @Min(0) monthlyPrice?: number;
  @IsOptional() @IsInt() @Min(0) yearlyPrice?: number;
  @IsOptional() @IsInt() @Min(0) userLimit?: number;
  @IsOptional() @IsInt() @Min(0) importLimit?: number;
  @IsOptional() @IsInt() @Min(0) branchLimit?: number;
  @IsOptional() @IsBoolean() customBranding?: boolean;
}

/** Sleeky Programmers' product admins set the timer's prices and limits. */
@UseGuards(ProductAdminJwtAuthGuard)
@Controller('service-timer/admin/plans')
export class TimerPlansAdminController {
  constructor(private readonly plans: TimerPlanService) {}

  @Get()
  list() {
    return this.plans.listConfigs();
  }

  @Put(':plan')
  update(
    @Param('plan') plan: string,
    @Body() dto: UpdatePlanDto,
    @AuthUser() productAdmin: { _id?: Types.ObjectId },
  ) {
    const key = [TimerPlan.FREE, TimerPlan.CHURCH].find(
      (p) => p.toLowerCase() === plan.toLowerCase(),
    );
    if (!key) {
      throw new NotFoundException('Unknown plan');
    }
    return this.plans.updateConfig(key, dto, productAdmin?._id ?? null);
  }
}
