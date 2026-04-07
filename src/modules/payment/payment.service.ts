import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment } from '../../schemas/payment.schema';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
  ) {}

  async createPayment(paymentData: Partial<Payment>) {
    const newPayment = new this.paymentModel(paymentData);
    return newPayment.save();
  }

  async findByReference(reference: string) {
    return this.paymentModel.findOne({ reference });
  }

  async updatePaymentStatus(reference: string, status: string, paidAt?: Date) {
    return this.paymentModel.findOneAndUpdate(
      { reference },
      { status, paidAt },
      { new: true },
    );
  }

  async getChurchPayments(churchId: string) {
    return this.paymentModel.find({ churchId }).sort({ createdAt: -1 });
  }
}
