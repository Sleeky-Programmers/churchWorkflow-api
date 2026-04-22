import { CloudinaryProvider } from './cloudinary.provider';
import { UploadProvider } from '../interfaces/upload-provider.interface';

export const UploadProviderFactory = {
  provide: 'UPLOAD_PROVIDER',
  useFactory: (cloudinary: CloudinaryProvider): UploadProvider => {
    const provider = process.env.FILE_UPLOAD_PROVIDER;

    switch (provider) {
      case 'cloudinary':
      default:
        return cloudinary;
    }
  },
  inject: [CloudinaryProvider],
};
