import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SmallTeam, SmallTeamSchema } from '../../schemas/small-team.schema';
import { SmallTeamsController } from './small-teams.controller';
import { SmallTeamsService } from './small-teams.service';
import { MembersModule } from '../members/members.module';
import { AttendanceModule } from '../attendance/attendance.module';
import { ChurchServicesModule } from '../church-services/church-services.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: SmallTeam.name, schema: SmallTeamSchema }]),
    MembersModule,
    AttendanceModule,
    ChurchServicesModule,
  ],
  controllers: [SmallTeamsController],
  providers: [SmallTeamsService],
})
export class SmallTeamsModule {}

