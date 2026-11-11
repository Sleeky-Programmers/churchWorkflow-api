import { Model, Types } from 'mongoose';

import {
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Currency } from '../../schemas/currency.schema';
import {
  GivingBatch,
  GivingBatchSource,
  GivingBatchStatus,
} from '../../schemas/giving-batch.schema';
import {
  GivingEntry,
  GivingEntryPaymentMethod,
} from '../../schemas/giving-entry.schema';
import { OfferingType } from '../../schemas/offering-type.schema';
import { ChurchService } from '../church/church.service';
import { FlutterwaveService } from '../flutterwave/flutterwave.service';
import { PaystackService } from '../paystack/paystack.service';
import { InitializeGivingDto } from './dto/initialize-giving.dto';
import { PaymentProvider } from '../../common/utils/enums.utils';

export interface OnlineGivingMetadata {
  type: 'online_giving';
  churchId: string;
  offeringTypeId: string;
  currencyCode: string;
  amount: number;
  donorName?: string | null;
  donorEmail?: string | null;
}

@Injectable()
export class OnlineGivingService {
  constructor(
    @InjectModel(OfferingType.name)
    private offeringTypeModel: Model<OfferingType>,
    @InjectModel(Currency.name) private currencyModel: Model<Currency>,
    @InjectModel(GivingBatch.name)
    private givingBatchModel: Model<GivingBatch>,
    @InjectModel(GivingEntry.name)
    private givingEntryModel: Model<GivingEntry>,
    private churchService: ChurchService,
    @Inject(
      forwardRef(() => {
        return PaystackService;
      }),
    )
    private paystackService: PaystackService,
    @Inject(
      forwardRef(() => {
        return FlutterwaveService;
      }),
    )
    private flutterwaveService: FlutterwaveService,
  ) {}

  private async resolveChurch(churchSlug: string) {
    const church = await this.churchService.findBySlug(churchSlug);
    if (!church) {
      throw new NotFoundException('Church not found');
    }
    return church;
  }

  async getGivingOptions(churchSlug: string) {
    const church = await this.resolveChurch(churchSlug);

    const [offeringTypes, currencies] = await Promise.all([
      this.offeringTypeModel
        .find({ churchId: church._id, isActive: true })
        .sort({ sortOrder: 1, name: 1 })
        .lean(),
      this.currencyModel
        .find({ churchId: church._id, isActive: true })
        .sort({ isDefault: -1, code: 1 })
        .lean(),
    ]);

    return {
      church: {
        id: church._id.toString(),
        name: church.name,
        slug: church.slug,
        logoUrl: church.logoUrl,
      },
      offeringTypes: offeringTypes.map((offeringType) => {
        return {
          id: offeringType._id.toString(),
          name: offeringType.name,
        };
      }),
      currencies: currencies.map((currency) => {
        return {
          code: currency.code,
          symbol: currency.symbol,
          name: currency.name,
          isDefault: currency.isDefault,
        };
      }),
    };
  }

  async initialize(churchSlug: string, dto: InitializeGivingDto) {
    const church = await this.resolveChurch(churchSlug);

    const offeringType = await this.offeringTypeModel.findOne({
      _id: dto.offeringTypeId,
      churchId: church._id,
    });
    if (!offeringType) {
      throw new NotFoundException('Offering type not found');
    }

    const metadata: OnlineGivingMetadata = {
      type: 'online_giving',
      churchId: church._id.toString(),
      offeringTypeId: offeringType._id.toString(),
      currencyCode: dto.currencyCode,
      amount: dto.amount,
      donorName: dto.donorName || null,
      donorEmail: dto.donorEmail || null,
    };

    if (dto.gateway === PaymentProvider.FLUTTERWAVE) {
      return this.flutterwaveService.initializeGivingTransaction({
        email: dto.donorEmail,
        amount: dto.amount,
        currencyCode: dto.currencyCode,
        metadata,
      });
    }

    return this.paystackService.initializeGivingTransaction({
      email: dto.donorEmail,
      amount: dto.amount,
      currencyCode: dto.currencyCode,
      metadata,
    });
  }

  // Called from the Paystack/Flutterwave webhook handlers once a charge
  // Tagged with metadata.type === 'online_giving' succeeds. Creates the
  // Confirmed batch + entry that represents the donation in the counting
  // Room data model, mirroring what a teller would record manually.
  async fulfillFromWebhook(
    metadata: OnlineGivingMetadata,
    paymentReference: string,
  ) {
    const existingEntry = await this.givingEntryModel.findOne({
      paymentReference,
    });
    if (existingEntry) {
      // Webhook delivery isn't guaranteed to be exactly-once - skip if this
      // Reference was already fulfilled.
      return existingEntry;
    }

    const amount = Number(metadata.amount) || 0;

    const batch = await this.givingBatchModel.create({
      churchId: new Types.ObjectId(metadata.churchId),
      branchId: null,
      churchServiceId: null,
      date: new Date().toISOString().slice(0, 10),
      status: GivingBatchStatus.CONFIRMED,
      source: GivingBatchSource.ONLINE,
      recordedBy: null,
      confirmedAt: new Date(),
      totalAmount: amount,
    });

    return this.givingEntryModel.create({
      batchId: batch._id,
      offeringTypeId: new Types.ObjectId(metadata.offeringTypeId),
      currencyCode: metadata.currencyCode,
      amount,
      paymentMethod: GivingEntryPaymentMethod.ONLINE,
      donorName: metadata.donorName || null,
      donorEmail: metadata.donorEmail || null,
      paymentReference,
    });
  }

  async verify(reference: string) {
    const entry = await this.givingEntryModel
      .findOne({ paymentReference: reference })
      .lean();

    if (!entry) {
      return { status: 'pending', reference };
    }

    return {
      status: 'success',
      reference,
      amount: entry.amount,
      currencyCode: entry.currencyCode,
      donorName: entry.donorName,
      donorEmail: entry.donorEmail,
    };
  }
}
