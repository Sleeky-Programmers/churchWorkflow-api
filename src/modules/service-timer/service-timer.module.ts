import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { Church, ChurchSchema } from '../../schemas/church.schema';
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
import { BranchModule } from '../branch/branch.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
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
      { name: Church.name, schema: ChurchSchema },
    ]),
    // Secrets are passed per call: admin tokens use JWT_SECRET, operator
    // Tokens a secret derived from it.
    JwtModule.register({}),
    AdminModule,
    BranchModule,
    FileUploadModule,
  ],
  controllers: [ServiceTimerController, ServiceTimerPublicController],
  providers: [ServiceTimerService, ServiceTimerEvents, ServiceTimerGateway],
  exports: [ServiceTimerService],
})
export class ServiceTimerModule {}
