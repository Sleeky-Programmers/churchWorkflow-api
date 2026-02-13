import { forwardRef, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { Admin, AdminSchema } from '../../schemas/admin.schema';
import { ChurchModule } from '../church/church.module';
import { RolesModule } from '../roles/roles.module';
import { AccountSettingsModule } from '../account-settings/account-settings.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Admin.name, schema: AdminSchema }]),
    forwardRef(() => ChurchModule),
    RolesModule,
    AccountSettingsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
