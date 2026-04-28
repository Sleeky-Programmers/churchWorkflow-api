import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { OverviewService } from './overview.service';
import { OverviewController } from './overview.controller';

import { ChurchModule } from '../church/church.module';
import { MembersModule } from '../members/members.module';

import { SubscriptionModule } from '../subscription/subscription.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([]),
    ChurchModule,
    MembersModule,
    SubscriptionModule,
    ActivityLogModule,
  ],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
