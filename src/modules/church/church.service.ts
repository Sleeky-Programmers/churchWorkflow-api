import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Church } from '../../schemas/church.schema';
import { Admin } from '../../schemas/admin.schema';
import { ChurchIdentityDto } from './dto/church-identity.dto';
import { FileUploadService } from '../file-upload/file-upload.service';
import { AdminService } from '../admin/admin.service';

@Injectable()
export class ChurchService {
  constructor(
    @InjectModel(Church.name) private churchModel: Model<Church>,
    private fileUploadService: FileUploadService,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
  ) {}

  async findById(id: Types.ObjectId) {
    return await this.churchModel.findById(id);
  }

  async create(
    authUser: Admin,
    churchIdentityDto: ChurchIdentityDto,
    file?: Express.Multer.File,
  ) {
    let url: string;
    let publicId: string;

    if (file) {
      const { url: fileUrl, publicId: filePublicId } =
        await this.fileUploadService.uploadFile(file);

      url = fileUrl;
      publicId = filePublicId;
    }

    const church = await this.churchModel.create({
      ...churchIdentityDto,
      logoUrl: url,
      logoPublicId: publicId,
    });

    await this.adminService.findByIdAndUpdate(authUser._id, {
      churchId: church._id,
    });

    return church;
  }
}
