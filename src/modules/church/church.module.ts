import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Church, ChurchSchema } from '../../schemas/church.schema';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { AdminActivityLogModule } from '../admin-activity-log/admin-activity-log.module';
import { AdminModule } from '../admin/admin.module';
import { BranchModule } from '../branch/branch.module';
import { EmailModule } from '../email/email.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { MembersModule } from '../members/members.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { ChurchController } from './church.controller';
import { ChurchService } from './church.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Church.name, schema: ChurchSchema }]),
    FileUploadModule,
    forwardRef(() => {
      return AdminModule;
    }),
    SubscriptionModule,
    AdminActivityLogModule,
    MembersModule,
    BranchModule,
    forwardRef(() => {
      return ActivityLogModule;
    }),
    forwardRef(() => {
      return EmailModule;
    }),
  ],

  controllers: [ChurchController],
  providers: [ChurchService],
  exports: [MongooseModule, ChurchService],
})
export class ChurchModule {}
