import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Member, MemberSchema } from '../../schemas/member.schema';
import { Title, TitleSchema } from '../../schemas/title.schema';
import { TitleController } from './title.controller';
import { TitleService } from './title.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Title.name, schema: TitleSchema },
      { name: Member.name, schema: MemberSchema },
    ]),
  ],
  controllers: [TitleController],
  providers: [TitleService],
  exports: [TitleService],
})
export class TitleModule {}
