import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Admin, AdminSchema } from '../../schemas/admin.schema';
import {
  AuthHandoff,
  AuthHandoffSchema,
} from '../../schemas/auth-handoff.schema';
import { AuthModule } from '../auth/auth.module';
import { AuthHandoffController } from './auth-handoff.controller';
import { AuthHandoffService } from './auth-handoff.service';

/** Signing in to one of our apps from another (see AuthHandoffService). */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuthHandoff.name, schema: AuthHandoffSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
    AuthModule,
  ],
  controllers: [AuthHandoffController],
  providers: [AuthHandoffService],
})
export class AuthHandoffModule {}
