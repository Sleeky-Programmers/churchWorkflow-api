import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Admin, AdminSchema } from '../../schemas/admin.schema';
import { Asset, AssetSchema } from '../../schemas/asset.schema';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import { Branch, BranchSchema } from '../../schemas/branch.schema';
import { Church, ChurchSchema } from '../../schemas/church.schema';
import { Department, DepartmentSchema } from '../../schemas/department.schema';
import { Expense, ExpenseSchema } from '../../schemas/expense.schema';
import {
  GivingBatch,
  GivingBatchSchema,
} from '../../schemas/giving-batch.schema';
import {
  GivingEntry,
  GivingEntrySchema,
} from '../../schemas/giving-entry.schema';
import { Member, MemberSchema } from '../../schemas/member.schema';
import {
  OfferingType,
  OfferingTypeSchema,
} from '../../schemas/offering-type.schema';
import {
  PastoralAlert,
  PastoralAlertSchema,
} from '../../schemas/pastoral-alert.schema';
import {
  ReportProfile,
  ReportProfileSchema,
} from '../../schemas/report-profile.schema';
import {
  ReportSnapshot,
  ReportSnapshotSchema,
} from '../../schemas/report-snapshot.schema';
import {
  Requisition,
  RequisitionSchema,
} from '../../schemas/requisition.schema';
import {
  ServiceInstance,
  ServiceInstanceSchema,
} from '../../schemas/service-instance.schema';
import { SmallTeam, SmallTeamSchema } from '../../schemas/small-team.schema';
import { EmailModule } from '../email/email.module';
import { ReportsController, ReportsJobsController } from './reports.controller';
import { ReportsDigestService } from './reports.digest.service';
import { ReportsExportService } from './reports.export.service';
import { ReportSectionsService } from './reports.sections';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Admin.name, schema: AdminSchema },
      { name: Asset.name, schema: AssetSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Church.name, schema: ChurchSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: Expense.name, schema: ExpenseSchema },
      { name: GivingBatch.name, schema: GivingBatchSchema },
      { name: GivingEntry.name, schema: GivingEntrySchema },
      { name: Member.name, schema: MemberSchema },
      { name: OfferingType.name, schema: OfferingTypeSchema },
      { name: PastoralAlert.name, schema: PastoralAlertSchema },
      { name: ReportProfile.name, schema: ReportProfileSchema },
      { name: ReportSnapshot.name, schema: ReportSnapshotSchema },
      { name: Requisition.name, schema: RequisitionSchema },
      { name: ServiceInstance.name, schema: ServiceInstanceSchema },
      { name: SmallTeam.name, schema: SmallTeamSchema },
    ]),
    EmailModule,
  ],
  controllers: [ReportsController, ReportsJobsController],
  providers: [
    ReportsService,
    ReportSectionsService,
    ReportsExportService,
    ReportsDigestService,
  ],
  exports: [ReportsService],
})
export class ReportsModule {}
