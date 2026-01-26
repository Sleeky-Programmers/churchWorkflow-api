import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Admin } from '../../schemas/admin.schema';
import { Church } from '../../schemas/church.schema';
import { ChurchIdentityDto } from './dto/church-identity.dto';
import { FileUploadService } from '../file-upload/file-upload.service';

@Injectable()
export class ChurchService {
  constructor(
    @InjectModel(Church.name) private churchModel: Model<Church>,
    private fileUploadService: FileUploadService,
  ) {}

  async findById(id: Types.ObjectId) {
    return await this.churchModel.findById(id);
  }

  async create(createChurchDto: { name: string }) {
    return await this.churchModel.create(createChurchDto);
  }

  async update(
    authUser: Admin,
    updateChurchDto: ChurchIdentityDto,
    file: Express.Multer.File,
  ) {
    const churchId = authUser.churchId;

    const church = await this.churchModel.findById(churchId);

    if (!church) {
      throw new NotFoundException('Church not found');
    }

    if (church.logoPublicId && file) {
      await this.fileUploadService.deleteFile(church.logoPublicId);
    }

    const { url, publicId } = await this.fileUploadService.uploadFile(file);

    return await this.churchModel.findByIdAndUpdate(
      churchId,
      { ...updateChurchDto, logoUrl: url, logoPublicId: publicId },
      {
        new: true,
      },
    );
  }
}
