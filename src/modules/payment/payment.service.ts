import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Payment } from '../../schemas/payment.schema';
import { PaymentStatus } from '../../common/utils/enums.utils';

@Injectable()
export class PaymentService {
  constructor(
    @InjectModel(Payment.name) private paymentModel: Model<Payment>,
  ) {}

  async createPayment(paymentData: Partial<Payment>) {
    return await this.paymentModel.create(paymentData);
  }

  async findByReference(reference: string) {
    return await this.paymentModel.findOne({ reference });
  }

  async updatePaymentStatus(
    reference: string,
    status: string,
    paidAt?: Date,
    extra: Partial<Payment> = {},
  ) {
    return await this.paymentModel.findOneAndUpdate(
      { reference },
      { status, paidAt, ...extra },
      { new: true },
    );
  }

  async createProviderSubscription(
    reference: string,
    provider: string,
    providerSubscriptionRef: string,
  ) {
    return await this.paymentModel.findOneAndUpdate(
      { reference },
      {
        $set: {
          'metadata.providerSubscription': {
            provider,
            providerSubscriptionRef,
            createdAt: new Date(),
          },
        },
      },
      { new: true },
    );
  }

  async getChurchPayments(churchId: string) {
    return await this.paymentModel.find({ churchId }).sort({ createdAt: -1 });
  }

  async hasUsedCoupon(churchId: any, couponCode: string) {
    if (!couponCode) {
      return false;
    }

    const payment = await this.paymentModel.findOne({
      churchId,
      'metadata.promoCode': couponCode,
      status: PaymentStatus.SUCCESS,
    });

    return !!payment;
  }

  async findByProviderSubscriptionCode(code: string) {
    if (!code) {
      return null;
    }
    return await this.paymentModel.findOne({
      'metadata.providerSubscription.providerSubscriptionRef.subscription_code':
        code,
    });
  }

  async markProviderSubscriptionCanceled(code: string) {
    if (!code) {
      return null;
    }
    return await this.paymentModel.updateMany(
      {
        'metadata.providerSubscription.providerSubscriptionRef.subscription_code':
          code,
      },
      {
        $set: {
          'metadata.providerSubscription.canceled': true,
          autoRenew: false,
        },
      },
    );
  }

  async findLatestByChurch(churchId: any) {
    return await this.paymentModel
      .findOne({ churchId })
      .sort({ createdAt: -1 });
  }
}
