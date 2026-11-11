import Anthropic from '@anthropic-ai/sdk';

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { Admin, AdminSchema } from '../../schemas/admin.schema';
import { Church, ChurchSchema } from '../../schemas/church.schema';
import { Invite, InviteSchema } from '../../schemas/invite.schema';
import {
  TimerImport,
  TimerImportSchema,
} from '../../schemas/timer-import.schema';
import {
  TimerSession,
  TimerSessionSchema,
} from '../../schemas/timer-session.schema';
import {
  TimerSettings,
  TimerSettingsSchema,
} from '../../schemas/timer-settings.schema';
import {
  TimerTemplate,
  TimerTemplateSchema,
} from '../../schemas/timer-template.schema';
import { AdminModule } from '../admin/admin.module';
import { AdminInviteModule } from '../admin-invite/admin-invite.module';
import { RolesModule } from '../roles/roles.module';
import {
  TimerPayment,
  TimerPaymentSchema,
  TimerPlanConfig,
  TimerPlanConfigSchema,
  TimerSubscription,
  TimerSubscriptionSchema,
} from '../../schemas/timer-billing.schema';
import { TimerPaystackClient } from './billing/paystack-client';
import {
  TimerBillingController,
  TimerPlansAdminController,
} from './billing/timer-billing.controller';
import { TimerBillingService } from './billing/timer-billing.service';
import { TimerPlanService } from './billing/timer-plan.service';
import { Branch, BranchSchema } from '../../schemas/branch.schema';
import {
  TimerItemRun,
  TimerItemRunSchema,
} from '../../schemas/timer-item-run.schema';
import { TimerReportsController } from './reports/timer-reports.controller';
import { TimerReportsService } from './reports/timer-reports.service';
import { TimerTeamController } from './team/timer-team.controller';
import { TimerTeamService } from './team/timer-team.service';
import { BranchModule } from '../branch/branch.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { TimerImportController } from './import/timer-import.controller';
import {
  ANTHROPIC_CLIENT,
  TimerImportService,
} from './import/timer-import.service';
import { ServiceTimerPublicController } from './service-timer-public.controller';
import { ServiceTimerController } from './service-timer.controller';
import { ServiceTimerEvents } from './service-timer.events';
import { ServiceTimerGateway } from './service-timer.gateway';
import { ServiceTimerService } from './service-timer.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TimerSettings.name, schema: TimerSettingsSchema },
      { name: TimerTemplate.name, schema: TimerTemplateSchema },
      { name: TimerSession.name, schema: TimerSessionSchema },
      { name: TimerImport.name, schema: TimerImportSchema },
      { name: Church.name, schema: ChurchSchema },
      { name: Admin.name, schema: AdminSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: TimerPlanConfig.name, schema: TimerPlanConfigSchema },
      { name: TimerSubscription.name, schema: TimerSubscriptionSchema },
      { name: TimerPayment.name, schema: TimerPaymentSchema },
      { name: TimerItemRun.name, schema: TimerItemRunSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    // Secrets are passed per call: admin tokens use JWT_SECRET, operator
    // Tokens a secret derived from it.
    JwtModule.register({}),
    AdminModule,
    AdminInviteModule,
    BranchModule,
    FileUploadModule,
    RolesModule,
  ],
  controllers: [
    ServiceTimerController,
    ServiceTimerPublicController,
    TimerImportController,
    TimerTeamController,
    TimerBillingController,
    TimerPlansAdminController,
    TimerReportsController,
  ],
  providers: [
    ServiceTimerService,
    ServiceTimerEvents,
    ServiceTimerGateway,
    TimerImportService,
    TimerTeamService,
    TimerReportsService,
    TimerPlanService,
    TimerBillingService,
    TimerPaystackClient,
    {
      // Without ANTHROPIC_API_KEY the API still starts; smart import answers 503.
      provide: ANTHROPIC_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const apiKey = config.get<string>('ANTHROPIC_API_KEY');
        return apiKey ? new Anthropic({ apiKey, timeout: 120_000 }) : null;
      },
    },
  ],
  exports: [ServiceTimerService],
})
export class ServiceTimerModule {}
