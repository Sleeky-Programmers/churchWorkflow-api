import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Admin, AdminSchema } from '../../schemas/admin.schema';
import { Asset, AssetSchema } from '../../schemas/asset.schema';
import { Department, DepartmentSchema } from '../../schemas/department.schema';
import { Member, MemberSchema } from '../../schemas/member.schema';
import { SmallTeam, SmallTeamSchema } from '../../schemas/small-team.schema';
import { SearchController } from './search.controller';
import { SearchThrottleGuard } from './search-throttle.guard';
import { SearchService } from './search.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Member.name, schema: MemberSchema },
      { name: Department.name, schema: DepartmentSchema },
      { name: SmallTeam.name, schema: SmallTeamSchema },
      { name: Asset.name, schema: AssetSchema },
      { name: Admin.name, schema: AdminSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService, SearchThrottleGuard],
})
export class SearchModule {}
