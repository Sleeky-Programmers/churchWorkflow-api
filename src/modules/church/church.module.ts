import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChurchService } from './church.service';
import { ChurchController } from './church.controller';
import { Church, ChurchSchema } from '../../schemas/church.schema';
import { FileUploadModule } from '../file-upload/file-upload.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Church.name, schema: ChurchSchema }]),
    FileUploadModule,
  ],
  controllers: [ChurchController],
  providers: [ChurchService],
  exports: [ChurchService],
})
export class ChurchModule {}
