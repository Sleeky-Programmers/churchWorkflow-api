import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Attendance, AttendanceSchema } from '../../schemas/attendance.schema';
import {
  ChurchService,
  ChurchServiceSchema,
} from '../../schemas/church-service.schema';
import { Member, MemberSchema } from '../../schemas/member.schema';
import { SmallTeam, SmallTeamSchema } from '../../schemas/small-team.schema';
import { SmallTeamsController } from './small-teams.controller';
import { SmallTeamsService } from './small-teams.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SmallTeam.name, schema: SmallTeamSchema },
      { name: Member.name, schema: MemberSchema },
      { name: Attendance.name, schema: AttendanceSchema },
      { name: ChurchService.name, schema: ChurchServiceSchema },
    ]),
  ],
  controllers: [SmallTeamsController],
  providers: [SmallTeamsService],
})
export class SmallTeamsModule {}
