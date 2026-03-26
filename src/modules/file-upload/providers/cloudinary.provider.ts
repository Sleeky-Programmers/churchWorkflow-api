import { Injectable } from '@nestjs/common';
import { UploadProvider } from '../interfaces/upload-provider.interface';
import { v2 as cloudinary } from 'cloudinary';

@Injectable()
export class CloudinaryProvider implements UploadProvider {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  async upload(
    file: Express.Multer.File,
  ): Promise<{ url: string; publicId?: string }> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: 'auto' }, (error, result) => {
          if (error) {
            return reject(error);
          }

          resolve({
            url: result.secure_url,
            publicId: result.public_id,
          });
        })
        .end(file.buffer);
    });
  }

  async delete(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}