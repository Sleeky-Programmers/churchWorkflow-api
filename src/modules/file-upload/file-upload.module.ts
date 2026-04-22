import { Module } from '@nestjs/common';
import { FileUploadService } from './file-upload.service';
import { FileUploadController } from './file-upload.controller';
import { CloudinaryProvider } from './providers/cloudinary.provider';
import { UploadProviderFactory } from './providers/upload-provider.factory';

@Module({
  controllers: [FileUploadController],
  providers: [FileUploadService, CloudinaryProvider, UploadProviderFactory],
  exports: [FileUploadService],
})
export class FileUploadModule {}
