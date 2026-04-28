import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChurchService } from './church.service';
import { ChurchController } from './church.controller';
import { Church, ChurchSchema } from '../../schemas/church.schema';
import { MembersModule } from '../members/members.module';
import { FileUploadModule } from '../file-upload/file-upload.module';
import { AdminModule } from '../admin/admin.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { AdminActivityLogModule } from '../admin-activity-log/admin-activity-log.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Church.name, schema: ChurchSchema }]),
    FileUploadModule,
    forwardRef(() => AdminModule),
    SubscriptionModule,
    AdminActivityLogModule,
    MembersModule,
  ],
  controllers: [ChurchController],
  providers: [ChurchService],
  exports: [ChurchService],
})
export class ChurchModule {}
