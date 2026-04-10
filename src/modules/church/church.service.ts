import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Church } from '../../schemas/church.schema';
import { Admin } from '../../schemas/admin.schema';
import { ChurchIdentityDto } from './dto/church-identity.dto';
import { FileUploadService } from '../file-upload/file-upload.service';
import { AdminService } from '../admin/admin.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { MembersService } from '../members/members.service';
import { ChurchDetails } from '../../common/utils/types.utils';

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

  async findAll(paginationBaseDto: any) {
    const { page = 1, limit = 20 } = paginationBaseDto;

    const skip = (page - 1) * limit;

    const [churches, itemCount] = await Promise.all([
      this.churchModel.find().skip(skip).limit(limit).lean(),
      this.churchModel.countDocuments(),
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
        const sub = await this.subscriptionService.getSubscription(church._id);

        let subscriptionStatus = 'Active';
        if (sub && sub.endDate) {
          const end = new Date(sub.endDate);
          if (end < now) {
            subscriptionStatus = 'Overdue';
          } else if (end.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000) {
            subscriptionStatus = 'Expiring soon';
          } else {
            subscriptionStatus = 'Active';
          }
        } else {
          subscriptionStatus = sub ? 'Active' : 'Overdue';
        }

        return {
          id: church._id,
          name: church.name,
          location:
            church.address ||
            `${church.state || ''} ${church.country || ''}`.trim(),
          totalMembers,
          totalUsers,
          plan: sub?.plan || null,
          subscriptionStatus,
        };
      }),
    );

    return {
      data,
      pagination: {
        page,
        limit,
        itemCount,
        totalPages: Math.ceil(itemCount / limit),
      },
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

    return {
      ...church,
      totalMembers,
      totalUsers,
      subscription,
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
}
