import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChurchService } from './church.service';
import { ChurchController } from './church.controller';
import { Church, ChurchSchema } from '../../schemas/church.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Church.name, schema: ChurchSchema }]),
  ],
  controllers: [ChurchController],
  providers: [ChurchService],
  exports: [ChurchService],
})
export class ChurchModule {}
