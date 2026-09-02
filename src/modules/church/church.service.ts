import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import {
  BillingCycle,
  ChurchSubscriptionStatus,
  ModuleSections,
  PlanType,
} from '../../common/utils/enums.utils';
import { ChurchDetails } from '../../common/utils/types.utils';
import { Admin } from '../../schemas/admin.schema';
import { Church } from '../../schemas/church.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AdminActivityLogService } from '../admin-activity-log/admin-activity-log.service';
import { AdminService } from '../admin/admin.service';
import { EmailService } from '../email/email.service';
import { renderEmailLayout } from '../email/templates/email-layout.template';
import { FileUploadService } from '../file-upload/file-upload.service';
import { MembersService } from '../members/members.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { BlockChurchDto, UnblockChurchDto } from './dto/block-church.dto';
import { ChurchFilterDto } from './dto/church-filter.dto';
import { ChurchIdentityDto } from './dto/church-identity.dto';
import { UpdateChurchPlanDto } from './dto/update-church-plan.dto';

@Injectable()
export class ChurchService {
  constructor(
    @InjectModel(Church.name) private churchModel: Model<Church>,
    private fileUploadService: FileUploadService,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
    private subscriptionService: SubscriptionService,
    private membersService: MembersService,
    private adminActivityLogService: AdminActivityLogService,
    private readonly activityLogService: ActivityLogService,
    private readonly emailService: EmailService,
  ) {}

  async findById(id: Types.ObjectId) {
    return await this.churchModel.findById(id);
  }

  async findAllChurches() {
    return await this.churchModel.find().lean();
  }

  async findAll(paginationBaseDto: ChurchFilterDto | PaginationBaseDto) {
    const {
      page = 1,
      limit = 20,
      search,
      subscriptionStatus,
    } = paginationBaseDto as ChurchFilterDto;

    const skip = (page - 1) * limit;
    const query: any = {};

    // Build search query
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
      ];
    }

    // Apply plan filter
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

    // Get churches based on whether subscriptionStatus filter is applied
    let churches;
    let itemCount;

    if (subscriptionStatus) {
      // Fetch all churches (no pagination) for status filtering
      const allChurches = await this.churchModel
        .find(query)
        .sort({ createdAt: -1 })
        .lean();

      // Process and filter churches
      const processedChurches =
        await this.processChurchesWithStatus(allChurches);
      const filteredChurches = processedChurches.filter(
        (church) => church.subscriptionStatus === subscriptionStatus,
      );

      churches = filteredChurches.slice(skip, skip + limit);
      itemCount = filteredChurches.length;
    } else {
      // Fetch paginated churches
      [churches, itemCount] = await Promise.all([
        this.churchModel
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        this.churchModel.countDocuments(query),
      ]);
    }

    // Process churches to get full data
    const now = new Date();
    const data = await Promise.all(
      churches.map(async (church) => {
        const [totalMembers, totalUsers, subscription] = await Promise.all([
          this.membersService.countMembersByChurch(church._id),
          this.adminService.countAdminsByChurch(church._id),
          this.subscriptionService.getSubscription(church._id),
        ]);

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

  private async processChurchesWithStatus(churches: any[]) {
    const now = new Date();

    return Promise.all(
      churches.map(async (church) => {
        const [totalMembers, totalUsers, subscription] = await Promise.all([
          this.membersService.countMembersByChurch(church._id),
          this.adminService.countAdminsByChurch(church._id),
          this.subscriptionService.getSubscription(church._id),
        ]);

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
  }
  async countAllChurches() {
    return this.churchModel.countDocuments();
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
    file?: any,
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

    await this.adminActivityLogService.create({
      action: 'Register Church',
      details: `Church ${church.name} registered`,
      plan: PlanType.STARTER,
    } as any);

    return church;
  }

  async getChurchStats() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [totalChurches, newChurchesLast30Days] = await Promise.all([
      this.churchModel.countDocuments().exec(),
      this.churchModel
        .countDocuments({
          createdAt: { $gte: thirtyDaysAgo },
        })
        .exec(),
    ]);

    return {
      totalChurches,
      newChurchesLast30Days,
    };
  }

  async update(churchId: Types.ObjectId, data: Partial<Church>, file?: any) {
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

  async blockChurch(
    churchId: Types.ObjectId,
    adminId: Types.ObjectId,
    blockChurchDto: BlockChurchDto,
  ) {
    const { reason, note } = blockChurchDto;
    const church = await this.churchModel.findById(churchId);
    if (!church) {
      throw new NotFoundException('Church not found');
    }

    if (church.isBlocked) {
      throw new BadRequestException('Church is already blocked');
    }

    // Update church
    church.isBlocked = true;
    church.blockedAt = new Date();
    church.blockedBy = adminId;
    church.blockReason = reason;
    church.blockHistory = [
      ...(church.blockHistory || []),
      {
        action: 'BLOCK',
        performedBy: adminId,
        reason,
        note: note || null,
        timestamp: new Date(),
      },
    ];
    await church.save();

    // Get admin details for logging
    const admin = await this.adminService.findById(adminId);

    // Log to activity logs
    await this.activityLogService.create({ churchId, _id: adminId } as any, {
      action: 'Church Blocked',
      module: ModuleSections.CHURCH,
      details: `Church ${church.name} was blocked by ${admin?.firstName || 'System'}. Reason: ${reason}`,
    });

    await this.adminActivityLogService.create({
      adminId: adminId,
      action: 'BLOCK_CHURCH',
      details: `Blocked church: ${church.name}. Reason: ${reason}`,
    });

    // Pause subscription
    await this.subscriptionService.pauseSubscription(churchId);

    // Send notification emails
    await this.sendBlockNotifications(church, admin, reason);

    return church;
  }

  async unblockChurch(
    churchId: Types.ObjectId,
    adminId: Types.ObjectId,
    unblockChurchDto: UnblockChurchDto,
  ) {
    const { reason, note } = unblockChurchDto;
    const church = await this.churchModel.findById(churchId);
    if (!church) {
      throw new NotFoundException('Church not found');
    }

    if (!church.isBlocked) {
      throw new BadRequestException('Church is not blocked');
    }

    // Update church
    church.isBlocked = false;
    church.unblockedAt = new Date();
    church.unblockedBy = adminId;
    church.blockHistory = [
      ...(church.blockHistory || []),
      {
        action: 'UNBLOCK',
        performedBy: adminId,
        reason: reason || null,
        note: note || null,
        timestamp: new Date(),
      },
    ];
    await church.save();

    const admin = await this.adminService.findById(adminId);

    // Log to activity logs
    await this.activityLogService.create({ churchId, _id: adminId } as any, {
      action: 'Church Unblocked',
      module: ModuleSections.CHURCH,
      details: `Church ${church.name} was unblocked by ${admin?.firstName || 'System'}.`,
    });

    await this.adminActivityLogService.create({
      adminId: adminId,
      action: 'UNBLOCK_CHURCH',
      details: `Unblocked church: ${church.name}${reason ? `. Reason: ${reason}` : ''}`,
    });

    // Resume subscription
    await this.subscriptionService.resumeSubscription(churchId);

    // Send notification emails
    await this.sendUnblockNotifications(church);

    return church;
  }

  // Product-admin override: sets a church's plan directly, bypassing payment.
  async updatePlanByAdmin(
    churchId: Types.ObjectId,
    adminId: Types.ObjectId,
    updateChurchPlanDto: UpdateChurchPlanDto,
  ) {
    const church = await this.churchModel.findById(churchId);
    if (!church) {
      throw new NotFoundException('Church not found');
    }

    const billingCycle =
      updateChurchPlanDto.billingCycle || BillingCycle.MONTHLY;

    const subscription = await this.subscriptionService.updateSubscription({
      churchId,
      plan: updateChurchPlanDto.plan,
      billingCycle,
    });

    const admin = await this.adminService.findById(adminId);

    await this.activityLogService.create({ churchId, _id: adminId } as any, {
      action: 'Church Plan Changed',
      module: ModuleSections.CHURCH,
      details: `${church.name}'s plan was changed to ${updateChurchPlanDto.plan} by ${admin?.firstName || 'System'} (admin override, no payment).`,
    });

    await this.adminActivityLogService.create({
      adminId: adminId,
      action: 'CHANGE_CHURCH_PLAN',
      details: `Changed plan for church: ${church.name} to ${updateChurchPlanDto.plan}`,
      plan: updateChurchPlanDto.plan as any,
    } as any);

    return {
      plan: subscription.plan,
      billingCycle,
      status: subscription.status,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
    };
  }

  async isChurchBlocked(churchId: Types.ObjectId): Promise<boolean> {
    const church = await this.churchModel
      .findById(churchId)
      .select('isBlocked');
    return church?.isBlocked || false;
  }

  async getBlockHistory(churchId: Types.ObjectId) {
    const church = await this.churchModel
      .findById(churchId)
      .select('blockHistory')
      .populate('blockHistory.performedBy', 'name email');
    return church?.blockHistory || [];
  }

  private async sendBlockNotifications(
    church: Church,
    admin: any,
    reason: string,
  ) {
    // Get all admins of this church
    const admins = await this.adminService.findByChurchId(church._id);

    // Send to church admins
    for (const churchAdmin of admins) {
      const html = renderEmailLayout({
        previewText: 'Your church account has been blocked',
        heading: 'Your church account has been blocked',
        greeting: `Dear ${churchAdmin.firstName},`,
        paragraphs: [
          `Your church <strong>${church.name}</strong> has been blocked by the platform administrators.`,
          'You will not be able to access the platform until the block is lifted.',
        ],
        infoRows: [{ label: 'Reason', value: reason }],
        fineprint: 'If you have any questions, please contact support.',
      });
      await this.emailService.sendEmail(
        churchAdmin.email,
        'Church Account Blocked',
        html,
      );
    }

    // Send to super admins
    const superAdmins = await this.adminService.findSuperAdmins();
    for (const superAdmin of superAdmins) {
      const html = renderEmailLayout({
        previewText: `Church Blocked: ${church.name}`,
        heading: 'Church Blocked',
        infoRows: [
          { label: 'Church', value: church.name },
          { label: 'Blocked By', value: admin?.name || 'System' },
          { label: 'Reason', value: reason },
          { label: 'Blocked At', value: new Date().toLocaleString() },
        ],
      });
      await this.emailService.sendEmail(
        superAdmin.email,
        `Church Blocked: ${church.name}`,
        html,
      );
    }
  }

  private async sendUnblockNotifications(church: Church) {
    // Get all admins of this church
    const admins = await this.adminService.findByChurchId(church._id);

    for (const churchAdmin of admins) {
      const html = renderEmailLayout({
        previewText: 'Your church account has been unblocked',
        heading: 'Your church account has been unblocked',
        greeting: `Dear ${churchAdmin.firstName},`,
        paragraphs: [
          `Your church <strong>${church.name}</strong> has been unblocked.`,
          'You can now access the platform again.',
        ],
        fineprint: 'If you have any questions, please contact support.',
      });
      await this.emailService.sendEmail(
        churchAdmin.email,
        'Church Account Unblocked',
        html,
      );
    }
  }
}
