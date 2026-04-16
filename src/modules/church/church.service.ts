import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Church } from '../../schemas/church.schema';
import { Admin } from '../../schemas/admin.schema';
import { ChurchIdentityDto } from './dto/church-identity.dto';
import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import { ChurchFilterDto } from './dto/church-filter.dto';
import { FileUploadService } from '../file-upload/file-upload.service';
import { AdminService } from '../admin/admin.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { MembersService } from '../members/members.service';
import { ChurchDetails } from '../../common/utils/types.utils';
import { ChurchSubscriptionStatus } from '../../common/utils/enums.utils';

@Injectable()
export class ChurchService {
  constructor(
    @InjectModel(Church.name) private churchModel: Model<Church>,
    private fileUploadService: FileUploadService,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
    private subscriptionService: SubscriptionService,
    private membersService: MembersService,
  ) {}

  async findById(id: Types.ObjectId) {
    return await this.churchModel.findById(id);
  }

  async findAll(paginationBaseDto: ChurchFilterDto | PaginationBaseDto) {
    const {
      page = 1,
      limit = 20,
      search,
    } = paginationBaseDto as ChurchFilterDto;

    const skip = (page - 1) * limit;

    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ];
    }

    const plan = (paginationBaseDto as any).plan;
    if (plan) {
      const churchIds = await this.subscriptionService.getChurchIdsByPlan(plan);
      if (!churchIds || churchIds.length === 0) {
        const totalCountEmpty = await this.churchModel.countDocuments();
        return {
          data: [],
          pagination: paginationMeta({ page, limit, itemCount: 0 }),
          totalCount: totalCountEmpty,
        };
      }

      query._id = { $in: churchIds };
    }

    const [churches, itemCount] = await Promise.all([
      this.churchModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.churchModel.countDocuments(query),
    ]);

    const now = new Date();

    const data = await Promise.all(
      churches.map(async (church) => {
        const totalMembers = await this.membersService.countMembersByChurch(
          church._id,
        );
        const totalUsers = await this.adminService.countAdminsByChurch(
          church._id,
        );
        const subscription = await this.subscriptionService.getSubscription(
          church._id,
        );

        let subscriptionStatus = ChurchSubscriptionStatus.ACTIVE;
        if (subscription && subscription.endDate) {
          const end = new Date(subscription.endDate);
          if (end < now) {
            subscriptionStatus = ChurchSubscriptionStatus.OVERDUE;
          } else if (end.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000) {
            subscriptionStatus = ChurchSubscriptionStatus.EXPIRING_SOON;
          } else {
            subscriptionStatus = ChurchSubscriptionStatus.ACTIVE;
          }
        } else {
          subscriptionStatus = subscription
            ? ChurchSubscriptionStatus.ACTIVE
            : ChurchSubscriptionStatus.OVERDUE;
        }

        return {
          id: church._id,
          name: church.name,
          location:
            church.address ||
            `${church.state || ''} ${church.country || ''}`.trim(),
          totalMembers,
          totalUsers,
          plan: subscription?.plan || null,
          subscriptionStatus,
        };
      }),
    );

    const totalCount = await this.churchModel.countDocuments();

    return {
      data,
      pagination: paginationMeta({ page, limit, itemCount }),
      totalCount,
    };
  }

  async findDetailsById(id: string): Promise<ChurchDetails> {
    const church = await this.churchModel.findById(id).lean();
    if (!church) {
      throw new Error('Church not found');
    }

    const totalMembers = await this.membersService.countMembersByChurch(
      church._id,
    );
    const totalUsers = await this.adminService.countAdminsByChurch(church._id);
    const subscription = await this.subscriptionService.getSubscription(
      church._id,
    );

    const superAdmin = await this.adminService.findFirstSuperAdminByChurch(
      church._id,
    );

    return {
      ...church,
      totalMembers,
      totalUsers,
      subscription,
      superAdmin,
    };
  }

  async findCurrentChurch(authUser: Admin) {
    if (!authUser.churchId) {
      return null;
    }

    return await this.churchModel.findById(authUser.churchId);
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

    const subscription = await this.subscriptionService.getSubscription(
      church._id,
    );

    if (!subscription) {
      await this.subscriptionService.createTrialSubscription(church._id);
    }

    return church;
  }

  async update(
    churchId: Types.ObjectId,
    data: Partial<Church>,
    file?: Express.Multer.File,
  ) {
    if (file) {
      const { url, publicId } = await this.fileUploadService.uploadFile(file);

      data.logoUrl = url;
      data.logoPublicId = publicId;
    }

    return await this.churchModel.findByIdAndUpdate(churchId, data, {
      new: true,
    });
  }

  async countAll() {
    return await this.churchModel.countDocuments();
  }

  async countRegisteredSince(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return await this.churchModel.countDocuments({
      createdAt: { $gte: since },
    });
  }
}
