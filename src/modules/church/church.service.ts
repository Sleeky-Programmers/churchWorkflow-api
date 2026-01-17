import { Church } from './../../schemas/church.schema';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

@Injectable()
export class ChurchService {
  constructor(@InjectModel(Church.name) private churchModel: Model<Church>) {}

  async create(createChurchDto: { name: string }) {
    return await this.churchModel.create(createChurchDto);
  }
}
