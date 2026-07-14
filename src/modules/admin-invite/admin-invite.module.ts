import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminInviteService } from './admin-invite.service';
import { AdminInviteController } from './admin-invite.controller';
import { Invite, InviteSchema } from '../../schemas/invite.schema';
import { ChurchModule } from '../church/church.module';
import { EmailModule } from '../email/email.module';
import { RolesModule } from '../roles/roles.module';
import { AdminModule } from '../admin/admin.module';
import { SubscriptionModule } from '../subscription/subscription.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Invite.name, schema: InviteSchema }]),
    ChurchModule,
    EmailModule,
    RolesModule,
    AdminModule,
    SubscriptionModule,
  ],
  controllers: [AdminInviteController],
  providers: [AdminInviteService],
  exports: [AdminInviteService],
})
export class AdminInviteModule {}
