export interface UploadProvider {
  upload(file: Express.Multer.File): Promise<{
    url: string;
    publicId?: string;
  }>;

  delete(publicId: string): Promise<void>;
}
