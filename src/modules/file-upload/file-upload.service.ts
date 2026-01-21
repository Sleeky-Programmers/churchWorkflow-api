import { Inject, Injectable } from '@nestjs/common';
import { UploadProvider } from './interfaces/upload-provider.interface';

@Injectable()
export class FileUploadService {
  constructor(
    @Inject('UPLOAD_PROVIDER')
    private readonly uploadProvider: UploadProvider,
  ) {}

  uploadFile(file: Express.Multer.File) {
    return this.uploadProvider.upload(file);
  }

  deleteFile(publicId: string) {
    return this.uploadProvider.delete(publicId);
  }
}
