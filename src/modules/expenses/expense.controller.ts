import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthUser } from '../../common/decorators/auth-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AccessLevel, ModuleSections } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseFilterDto } from './dto/expense-filter.dto';
import { ExpenseSummaryFilterDto } from './dto/expense-summary-filter.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseService } from './expense.service';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @Post()
  @RequirePermissions({
    section: ModuleSections.GIVING_AND_EXPENSES,
    level: AccessLevel.MANAGE,
  })
  create(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: CreateExpenseDto,
  ) {
    return this.expenseService.create(authUser, tenant, dto);
  }

  @Get()
  @RequirePermissions({
    section: ModuleSections.GIVING_AND_EXPENSES,
    level: AccessLevel.VIEW,
  })
  findAll(
    @CurrentTenant() tenant: TenantContext,
    @Query() dto: ExpenseFilterDto,
  ) {
    return this.expenseService.findAll(tenant, dto);
  }

  @Get('monthly-trend')
  @RequirePermissions({
    section: ModuleSections.GIVING_AND_EXPENSES,
    level: AccessLevel.VIEW,
  })
  monthlyTrend(@CurrentTenant() tenant: TenantContext) {
    return this.expenseService.monthlyTrend(tenant);
  }

  @Get('summary')
  @RequirePermissions({
    section: ModuleSections.GIVING_AND_EXPENSES,
    level: AccessLevel.VIEW,
  })
  summary(
    @CurrentTenant() tenant: TenantContext,
    @Query() dto: ExpenseSummaryFilterDto,
  ) {
    return this.expenseService.summary(tenant, dto);
  }

  @Get(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING_AND_EXPENSES,
    level: AccessLevel.VIEW,
  })
  findById(@CurrentTenant() tenant: TenantContext, @Param('id') id: string) {
    return this.expenseService.findById(tenant, id);
  }

  @Put(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING_AND_EXPENSES,
    level: AccessLevel.MANAGE,
  })
  update(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
    @Body() dto: UpdateExpenseDto,
  ) {
    return this.expenseService.update(authUser, tenant, id, dto);
  }

  @Delete(':id')
  @RequirePermissions({
    section: ModuleSections.GIVING_AND_EXPENSES,
    level: AccessLevel.FULL_ACCESS,
  })
  delete(
    @AuthUser() authUser: Admin,
    @CurrentTenant() tenant: TenantContext,
    @Param('id') id: string,
  ) {
    return this.expenseService.delete(authUser, tenant, id);
  }
}
