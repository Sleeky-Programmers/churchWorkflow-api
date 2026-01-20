import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Otp } from '../../schemas/otp.schema';

@Injectable()
export class OtpService {
  constructor(@InjectModel(Otp.name) private otpModel: Model<Otp>) {}

  generateOtp() {
    return Math.floor(100000 + Math.random() * 900000);
  }

  async create(email: string) {
    const otp = this.generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
    return await this.otpModel.create({ email, otp, otpExpiry });
  }

  async findLatestByEmail(email: string) {
    return await this.otpModel.findOne({ email }).sort({ createdAt: -1 });
  }

  async markAsUsed(id: Types.ObjectId) {
    return await this.otpModel.findByIdAndUpdate(id, { isUsed: true });
  }
}
