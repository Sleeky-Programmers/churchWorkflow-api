import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SmallTeam, SmallTeamSchema } from '../../schemas/small-team.schema';
import { SmallTeamsController } from './small-teams.controller';
import { SmallTeamsService } from './small-teams.service';
import { MembersModule } from '../members/members.module';
import { AdminModule } from '../admin/admin.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ChurchServicesModule } from '../church-services/church-services.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SmallTeam.name, schema: SmallTeamSchema },
    ]),
    MembersModule,
    AdminModule,
    AttendanceModule,
    ChurchServicesModule,
  ],
  controllers: [SmallTeamsController],
  providers: [SmallTeamsService],
  exports: [SmallTeamsService],
})
export class SmallTeamsModule {}
