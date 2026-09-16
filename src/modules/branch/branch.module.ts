import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Admin, AdminSchema } from '../../schemas/admin.schema';
import {
  AdminBranchAccess,
  AdminBranchAccessSchema,
} from '../../schemas/admin-branch-access.schema';
import { Branch, BranchSchema } from '../../schemas/branch.schema';
import { BranchController } from './branch.controller';
import { BranchService } from './branch.service';
import { TenantContextService } from './tenant-context.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Branch.name, schema: BranchSchema },
      { name: AdminBranchAccess.name, schema: AdminBranchAccessSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
  ],
  controllers: [BranchController],
  providers: [BranchService, TenantContextService],
  exports: [BranchService, TenantContextService],
})
export class BranchModule {}
