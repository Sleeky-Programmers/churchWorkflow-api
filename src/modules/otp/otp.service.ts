import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Otp } from '../../schemas/otp.schema';
import { EmailService } from '../email/email.service';

@Injectable()
export class OtpService {
  constructor(
    @InjectModel(Otp.name) private otpModel: Model<Otp>,
    private emailService: EmailService,
  ) {}

  generateOtp() {
    return Math.floor(100000 + Math.random() * 900000);
  }

  async create(email: string) {
    const otp = this.generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const subject = 'Your OTP Code';
    const html = `<p>Your OTP code is: <b>${otp}</b></p><p>This code will expire in 10 minutes.</p>`;
    await this.emailService.sendEmail(email, subject, html);

    return await this.otpModel.create({ email, otp, otpExpiry });
  }

  async findLatestByEmail(email: string) {
    return await this.otpModel.findOne({ email }).sort({ createdAt: -1 });
  }

  async markAsUsed(id: Types.ObjectId) {
    return await this.otpModel.findByIdAndUpdate(id, { isUsed: true });
  }
}
