import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Model, Types } from 'mongoose';
import { Readable } from 'stream';

import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import {
  normalizeDateKey,
  normalizeKey,
  normalizeText,
  parseBoolean,
  parseOptionalDate,
} from '../../common/helpers/normalize.helper';
import {
  MembersFilterDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import {
  GENDER_MAP,
  MARITAL_STATUS_MAP,
  MEMBERSHIP_STATUS_MAP,
  TITLE_MAP,
} from '../../common/utils/const.utils';
import {
  Gender,
  MaritalStatus,
  MemberFilter,
  MembershipStatus,
  ModuleSections,
  NotificationType,
  PlanType,
} from '../../common/utils/enums.utils';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { buildTenantFilter } from '../../common/utils/tenant-filter.util';
import { Admin } from '../../schemas/admin.schema';
import { Member } from '../../schemas/member.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ChurchServicesService } from '../church-services/church-services.service';
import { NotificationService } from '../notification/notification.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { CreateMemberDto } from './dto/create-member.dto';
import {
  MemberAttendanceFilterDto,
  MemberAttendanceStatsFilterDto,
} from './dto/member-attendance-filter.dto';
import { MemberManagementDto } from './dto/member-management.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

const csv = require('csv-parser');

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(Member.name)
    private memberModel: Model<Member>,
    @Inject(forwardRef(() => AttendanceService))
    private readonly attendanceService: AttendanceService,
    @Inject(forwardRef(() => ChurchServicesService))
    private readonly churchServicesService: ChurchServicesService,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationService: NotificationService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  async countMembersByChurch(churchId: Types.ObjectId) {
    return await this.memberModel.countDocuments({
      churchId: new Types.ObjectId(churchId),
    });
  }

  async countAllMembers() {
    return await this.memberModel.countDocuments();
  }

  async countMembersByChurchIds(churchIds: string[] | any[]) {
    if (!churchIds || churchIds.length === 0) {
      return 0;
    }
    const ids = churchIds.map((id) => new Types.ObjectId(id));
    return await this.memberModel.countDocuments({ churchId: { $in: ids } });
  }

  async countRegisteredSince(days: number) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return await this.memberModel.countDocuments({
      createdAt: { $gte: since },
    });
  }

  async countMembersUpTo(date: Date) {
    return await this.memberModel.countDocuments({ createdAt: { $lte: date } });
  }

  async getMemberAttendanceStats(
    tenant: TenantContext,
    id: string,
    dto: MemberAttendanceStatsFilterDto,
  ) {
    await this.assertMemberInTenant(tenant, id);

    return await this.attendanceService.getMemberAttendanceStatsFilter(
      id,
      dto.days,
    );
  }

  async getMemberAttendance(
    tenant: TenantContext,
    id: string,
    dto: MemberAttendanceFilterDto,
  ) {
    await this.assertMemberInTenant(tenant, id);

    const { page, limit, serviceType, serviceId } = dto;
    const skip = (page! - 1) * limit!;

    let serviceIds: any = undefined;

    if (serviceId) {
      serviceIds = [new Types.ObjectId(serviceId)];
    } else if (serviceType) {
      serviceIds =
        await this.churchServicesService.getServiceIdsByType(serviceType);
    }

    const { attendances, itemCount } =
      await this.attendanceService.getMemberAttendanceFilter(
        id,
        limit!,
        skip,
        serviceIds,
      );

    const formattedData = attendances.map((record: any) => ({
      _id: record._id,
      date: record.date,
      status: record.status,
      title: record.churchServiceId?.title,
      serviceType: record.churchServiceId?.type,
      recordedBy: `${record.recordedBy.firstName} ${record.recordedBy.lastName}`,
      timestamp: record.createdAt,
    }));

    return {
      data: formattedData,
      pagination: paginationMeta({ page: page!, limit: limit!, itemCount }),
    };
  }

  async createMembersByCsv(
    authUser: Admin,
    tenant: TenantContext,
    fileBuffer: Buffer,
  ) {
    const members: Partial<Member>[] = [];
    const errors: { row: number; column?: string; reason: string }[] = [];
    const existingEmailSet = new Set<string>();
    const existingIdentitySet = new Set<string>();
    const existingPhoneSet = new Set<string>();
    const batchEmailSet = new Set<string>();
    const batchIdentitySet = new Set<string>();
    const batchPhoneSet = new Set<string>();

    let rowIndex = 1;

    const existingMembers = await this.memberModel
      .find(buildTenantFilter(tenant))
      .select('email fullName phoneNumber birthday')
      .lean();

    for (const member of existingMembers) {
      const emailKey = normalizeText(member.email);
      if (emailKey) {
        existingEmailSet.add(emailKey);
      }

      const phoneKey = normalizeText(member.phoneNumber);
      if (phoneKey) {
        existingPhoneSet.add(phoneKey);
      }

      const identityKey = [
        normalizeText(member.fullName),
        normalizeDateKey(member.birthday),
        normalizeText(member.phoneNumber),
      ].join('|');

      if (identityKey !== '||') {
        existingIdentitySet.add(identityKey);
      }
    }

    const stream = Readable.from(fileBuffer).pipe(csv());

    try {
      for await (const row of stream) {
        rowIndex++;

        try {
          const rowErrors: { column?: string; reason: string }[] = [];

          if (!row.fullName?.trim()) {
            rowErrors.push({
              column: 'fullName',
              reason: 'Full name is required',
            });
          }

          const normalizedGender = GENDER_MAP[normalizeKey(row.gender)];
          if (!row.gender?.trim()) {
            rowErrors.push({
              column: 'gender',
              reason: 'Gender is required',
            });
          } else if (!normalizedGender) {
            rowErrors.push({
              column: 'gender',
              reason: `Invalid gender "${row.gender}". Allowed values: MALE or FEMALE`,
            });
          }

          const birthday = parseOptionalDate(row.birthday);
          if (row.birthday?.trim() && !birthday) {
            rowErrors.push({
              column: 'birthday',
              reason: 'Invalid birthday date format',
            });
          }

          const dateOfMarriage = parseOptionalDate(row.dateOfMarriage);
          if (row.dateOfMarriage?.trim() && !dateOfMarriage) {
            rowErrors.push({
              column: 'dateOfMarriage',
              reason: 'Invalid dateOfMarriage format',
            });
          }

          const dateJoined = parseOptionalDate(row.dateJoined);
          if (row.dateJoined?.trim() && !dateJoined) {
            rowErrors.push({
              column: 'dateJoined',
              reason: 'Invalid dateJoined format',
            });
          }

          const normalizedTitle = TITLE_MAP[normalizeKey(row.title)] || null;
          if (row.title?.trim() && !normalizedTitle) {
            rowErrors.push({
              column: 'title',
              reason: `Invalid title "${row.title}"`,
            });
          }

          const normalizedMaritalStatus =
            MARITAL_STATUS_MAP[normalizeKey(row.maritalStatus)];
          if (
            row.maritalStatus?.trim() &&
            normalizedMaritalStatus === undefined
          ) {
            rowErrors.push({
              column: 'maritalStatus',
              reason: `Invalid maritalStatus "${row.maritalStatus}"`,
            });
          }

          const normalizedMembershipStatus =
            MEMBERSHIP_STATUS_MAP[normalizeKey(row.membershipStatus)] ||
            MembershipStatus.MEMBER;

          const isBaptized = parseBoolean(row.isBaptized);
          if (row.isBaptized?.trim() && isBaptized === null) {
            rowErrors.push({
              column: 'isBaptized',
              reason: 'isBaptized must be true/false, yes/no, or 1/0',
            });
          }

          if (rowErrors.length) {
            rowErrors.forEach((err) =>
              errors.push({
                row: rowIndex,
                ...err,
              }),
            );
            continue;
          }

          const parsedData: CreateMemberDto = {
            title: normalizedTitle,
            fullName: row.fullName?.trim(),
            gender: normalizedGender as Gender,
            birthday,
            maritalStatus: normalizedMaritalStatus,
            dateOfMarriage,
            phoneNumber: row.phoneNumber?.trim(),
            email: row.email?.toLowerCase()?.trim(),
            occupation: row.occupation?.trim(),
            educationalBackground: row.educationalBackground?.trim(),
            membershipStatus: normalizedMembershipStatus,
            dateJoined,
            previousChurchMembership: row.previousChurchMembership?.trim(),
            isBaptized,
            ministries: row.ministries?.trim(),
            volunteerPreferences: row.volunteerPreferences?.trim(),
            cellGroupName: row.cellGroupName?.trim(),
          };

          const emailKey = normalizeText(parsedData.email);
          if (
            emailKey &&
            (existingEmailSet.has(emailKey) || batchEmailSet.has(emailKey))
          ) {
            rowErrors.push({
              column: 'email',
              reason: 'Member with this email already exists',
            });
          }

          const phoneKey = normalizeText(parsedData.phoneNumber);
          if (
            phoneKey &&
            (existingPhoneSet.has(phoneKey) || batchPhoneSet.has(phoneKey))
          ) {
            rowErrors.push({
              column: 'phoneNumber',
              reason: 'Member with this phone number already exists',
            });
          }

          const identityKey = [
            normalizeText(parsedData.fullName),
            normalizeDateKey(parsedData.birthday),
            normalizeText(parsedData.phoneNumber),
          ].join('|');

          if (
            identityKey !== '||' &&
            (existingIdentitySet.has(identityKey) ||
              batchIdentitySet.has(identityKey))
          ) {
            rowErrors.push({
              column: 'fullName',
              reason: 'Duplicate member record already exists',
            });
          }

          if (rowErrors.length) {
            rowErrors.forEach((err) =>
              errors.push({
                row: rowIndex,
                ...err,
              }),
            );
            continue;
          }

          const dtoInstance = plainToInstance(CreateMemberDto, parsedData);

          const validationErrors = await validate(dtoInstance);

          if (validationErrors.length > 0) {
            validationErrors.forEach((err) => {
              const message = Object.values(err.constraints || {}).join(', ');

              errors.push({
                row: rowIndex,
                column: err.property,
                reason: message,
              });
            });

            continue;
          }

          members.push({
            churchId: tenant.churchId,
            branchId: tenant.branchId,
            ...dtoInstance,
          });

          if (emailKey) {
            batchEmailSet.add(emailKey);
          }
          if (phoneKey) {
            batchPhoneSet.add(phoneKey);
          }
          if (identityKey !== '||') {
            batchIdentitySet.add(identityKey);
          }
        } catch (err: any) {
          errors.push({
            row: rowIndex,
            reason: err.message || 'Unexpected error',
          });
        }
      }
    } catch {
      throw new BadRequestException('Failed to parse CSV file');
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'CSV validation failed. No members were imported.',
        totalErrors: errors.length,
        errors,
      });
    }

    // Check member limit before bulk inserting
    const currentMembers = await this.countMembersByChurch(authUser.churchId);
    const projectedCount = currentMembers + members.length;
    const limitCheck = await this.subscriptionService.checkMemberLimit(
      authUser.churchId,
      projectedCount,
    );

    if (!limitCheck.allowed && limitCheck.type === 'BLOCK') {
      throw new BadRequestException(
        limitCheck.message || 'Member limit reached',
      );
    }

    const insertedDocs = await this.memberModel.insertMany(members);

    await this.activityLogService.create(authUser, {
      action: 'Bulk Member Import',
      module: ModuleSections.MEMBERS,
      details: `Imported ${insertedDocs.length} members via CSV.`,
    });

    await this.notificationService.createNotification(authUser.churchId, {
      title: 'Members Imported',
      body: `${insertedDocs.length} members were successfully imported.`,
      type: NotificationType.MEMBER,
    });

    return {
      inserted: insertedDocs.length,
    };
  }

  async addMember(
    authUser: Admin,
    tenant: TenantContext,
    createMemberDto: CreateMemberDto,
  ) {
    const payload = {
      ...createMemberDto,
      membershipStatus:
        createMemberDto.membershipStatus || MembershipStatus.MEMBER,
    };

    // Ensure email or phone is unique within the branch
    const email = payload.email?.toLowerCase()?.trim();
    const phone = payload.phoneNumber?.trim();

    if (email || phone) {
      const conflict = await this.memberModel.findOne({
        ...buildTenantFilter(tenant),
        $or: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phoneNumber: phone }] : []),
        ],
      });

      if (conflict) {
        if (
          conflict.email &&
          email &&
          normalizeText(conflict.email) === normalizeText(email)
        ) {
          throw new BadRequestException(
            'Member with this email already exists',
          );
        }
        if (
          conflict.phoneNumber &&
          phone &&
          normalizeText(conflict.phoneNumber) === normalizeText(phone)
        ) {
          throw new BadRequestException(
            'Member with this phone number already exists',
          );
        }
        throw new BadRequestException(
          'Member with same contact already exists',
        );
      }
    }

    // Check member limit before creating single member
    const currentMembersCount = await this.countMembersByChurch(
      authUser.churchId,
    );
    const singleLimitCheck = await this.subscriptionService.checkMemberLimit(
      authUser.churchId,
      currentMembersCount + 1,
    );

    if (!singleLimitCheck.allowed && singleLimitCheck.type === 'BLOCK') {
      throw new BadRequestException(
        singleLimitCheck.message || 'Member limit reached',
      );
    }

    const createdMember = await this.memberModel.create({
      churchId: tenant.churchId,
      branchId: tenant.branchId,
      ...payload,
    });

    await this.activityLogService.create(authUser, {
      action: 'Created Member',
      module: ModuleSections.MEMBERS,
      details: `Created member: ${createdMember.fullName}`,
    });

    await this.notificationService.createNotification(authUser.churchId, {
      title: 'New Member Added',
      body: `${createdMember.fullName} has been added as a member.`,
      type: NotificationType.MEMBER,
    });

    return createdMember;
  }

  async getMemberStats(tenant: TenantContext) {
    const tenantFilter = buildTenantFilter(tenant);

    const totalMembers = await this.memberModel.countDocuments(tenantFilter);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const previousTotal = await this.memberModel.countDocuments({
      ...tenantFilter,
      createdAt: { $lt: thirtyDaysAgo },
    });

    let growthValue = 0;
    if (previousTotal === 0) {
      growthValue = totalMembers > 0 ? 100 : 0;
    } else {
      const difference = totalMembers - previousTotal;
      growthValue = (difference / previousTotal) * 100;
    }

    const growthText =
      growthValue >= 0
        ? `+${growthValue.toFixed(0)}%`
        : `${growthValue.toFixed(0)}%`;

    return {
      totalMembers,
      growth: growthText,
    };
  }

  async getAllMembers(tenant: TenantContext, dto: MembersFilterDto) {
    const { page, limit, search, filter } = dto;

    const skip = (page - 1) * limit;

    const query: any = buildTenantFilter(tenant);

    // Independent facet filters (combined with AND). The legacy single-string
    // `filter` param still works for backwards compatibility.
    if (dto.gender) query.gender = dto.gender;
    if (dto.maritalStatus) query.maritalStatus = dto.maritalStatus;
    if (dto.membershipStatus) query.membershipStatus = dto.membershipStatus;

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    switch (filter) {
      case MemberFilter.MALE:
        query.gender = Gender.MALE;
        break;
      case MemberFilter.FEMALE:
        query.gender = Gender.FEMALE;
        break;
      case MemberFilter.MARRIED:
        query.maritalStatus = MaritalStatus.MARRIED;
        break;
      case MemberFilter.SINGLE:
        query.maritalStatus = MaritalStatus.SINGLE;
        break;
      case MemberFilter.DIVORCED:
        query.maritalStatus = MaritalStatus.DIVORCED;
        break;
      case MemberFilter.WIDOWED:
        query.maritalStatus = MaritalStatus.WIDOWED;
        break;
      case MemberFilter.VISITOR:
        query.membershipStatus = MembershipStatus.VISITOR;
        break;
      case MemberFilter.VOLUNTEER:
        query.membershipStatus = MembershipStatus.VOLUNTEER;
        break;
      case MemberFilter.LEADER:
        query.membershipStatus = MembershipStatus.LEADER;
        break;
      case MemberFilter.MEMBER:
        query.membershipStatus = MembershipStatus.MEMBER;
        break;
      case MemberFilter.WORKER:
        query.membershipStatus = MembershipStatus.WORKER;
        break;
      case MemberFilter.CONVERT:
        query.membershipStatus = MembershipStatus.CONVERT;
        break;
      case MemberFilter.IS_BAPTIZED:
        query.isBaptized = true;
        break;
      case MemberFilter.NEW_MEMBERS:
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        query.dateJoined = { $gte: thirtyDaysAgo };
        break;
      default:
        break;
    }

    const [members, itemCount] = await Promise.all([
      this.memberModel
        .find(query)
        .skip(skip)
        .limit(limit)
        .lean() // Use lean() for better performance
        .exec(),
      this.memberModel.countDocuments(query).exec(),
    ]);

    return {
      data: members,
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async getAllMembersNoPagination(tenant: TenantContext) {
    return this.memberModel.find(buildTenantFilter(tenant));
  }

  async findAll(tenant: TenantContext) {
    return await this.memberModel.find(buildTenantFilter(tenant));
  }

  async findByIdInChurch(memberId: string, tenant: TenantContext) {
    return await this.memberModel
      .findOne({
        _id: memberId,
        ...buildTenantFilter(tenant),
      })
      .select('_id fullName')
      .lean();
  }

  async countMembersInChurch(memberIds: string[], tenant: TenantContext) {
    return await this.memberModel.countDocuments({
      _id: { $in: memberIds.map((id) => new Types.ObjectId(id)) },
      ...buildTenantFilter(tenant),
    });
  }

  private async assertMemberInTenant(tenant: TenantContext, memberId: string) {
    const member = await this.memberModel
      .findOne({ _id: memberId, ...buildTenantFilter(tenant) })
      .lean();

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    return member;
  }

  async getMemberById(
    tenant: TenantContext,
    id: string,
    dto?: MemberAttendanceFilterDto,
  ): Promise<any> {
    const page = dto?.page || 1;
    const limit = dto?.limit || 10;

    const [member, attendanceStats, attendance] = await Promise.all([
      this.assertMemberInTenant(tenant, id),
      this.attendanceService.getMemberAttendanceStatsFilter(id),
      this.getMemberAttendance(tenant, id, { ...dto, page, limit }),
    ]);

    return {
      ...member,
      attendanceStats,
      attendanceList: attendance.data,
      attendancePagination: attendance.pagination,
    };
  }

  async topChurchesByMembers() {
    const topChurchByMembers = await this.memberModel.aggregate([
      {
        $group: {
          _id: '$churchId',
          membersCount: { $sum: 1 },
        },
      },
      { $sort: { membersCount: -1 } },
      { $limit: 10 },

      {
        $lookup: {
          from: 'churches',
          localField: '_id',
          foreignField: '_id',
          as: 'church',
        },
      },
      {
        $unwind: {
          path: '$church',
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $lookup: {
          from: 'subscriptions',
          let: { churchId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$churchId', '$$churchId'] } } },
            { $limit: 1 },
          ],
          as: 'subscription',
        },
      },
      {
        $unwind: {
          path: '$subscription',
          preserveNullAndEmptyArrays: true,
        },
      },

      {
        $project: {
          _id: 0,
          id: '$_id',
          name: '$church.name',
          location: {
            $concat: [
              { $ifNull: ['$church.state', ''] },
              ', ',
              { $ifNull: ['$church.country', ''] },
            ],
          },
          membersCount: 1,
          plan: '$subscription.plan',
        },
      },
    ]);

    return { topChurchByMembers };
  }

  async updateMember(
    tenant: TenantContext,
    id: string,
    updateMemberDto: UpdateMemberDto,
  ) {
    const member = await this.assertMemberInTenant(tenant, id);

    const email = updateMemberDto.email?.toLowerCase()?.trim();
    const phone = updateMemberDto.phoneNumber?.trim();

    if (email || phone) {
      const conflict = await this.memberModel.findOne({
        churchId: member.churchId,
        branchId: member.branchId,
        _id: { $ne: new Types.ObjectId(id) },
        $or: [
          ...(email ? [{ email }] : []),
          ...(phone ? [{ phoneNumber: phone }] : []),
        ],
      });

      if (conflict) {
        if (
          conflict.email &&
          email &&
          normalizeText(conflict.email) === normalizeText(email)
        ) {
          throw new BadRequestException(
            'Member with this email already exists',
          );
        }
        if (
          conflict.phoneNumber &&
          phone &&
          normalizeText(conflict.phoneNumber) === normalizeText(phone)
        ) {
          throw new BadRequestException(
            'Member with this phone number already exists',
          );
        }
        throw new BadRequestException(
          'Member with same contact already exists',
        );
      }
    }

    return await this.memberModel.findOneAndUpdate(
      { _id: id, ...buildTenantFilter(tenant) },
      updateMemberDto,
      { new: true },
    );
  }

  async deleteMember(tenant: TenantContext, id: string) {
    const deleted = await this.memberModel.findOneAndDelete({
      _id: id,
      ...buildTenantFilter(tenant),
    });

    if (!deleted) {
      throw new NotFoundException('Member not found');
    }

    return deleted;
  }

  async getAllMembersForManagement(
    authUser: Admin,
    filters: MemberManagementDto,
  ) {
    const { churchId, limit, page, membershipStatus, search, status, role } =
      filters;
    const skip = (page - 1) * limit;
    const query: any = {};

    // If admin has a churchId (church admin), only show their church members
    if (authUser.churchId) {
      query.churchId = authUser.churchId;
    }

    // Apply church filter
    if (churchId && churchId !== 'all' && !authUser.churchId) {
      query.churchId = new Types.ObjectId(churchId);
    }

    // Apply membership status filter
    if (membershipStatus) {
      query.membershipStatus = membershipStatus;
    }

    if (role) {
      query.membershipStatus = role.toUpperCase();
    }

    // Filter by active status (status is boolean: true = active, false = inactive)
    if (status !== undefined && status !== null && status !== '') {
      // Status comes as string from query params
      if (typeof status === 'string') {
        query.isActive = status === 'true';
      } else {
        query.isActive = status;
      }
    }

    // Search functionality
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
      ];
    }

    const [members, totalCount] = await Promise.all([
      this.memberModel
        .find(query)
        .populate('churchId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.memberModel.countDocuments(query),
    ]);

    // Get all churches for church filter dropdown (only for platform admins)
    let churches = [];
    if (!authUser.churchId) {
      churches = await this.memberModel.aggregate([
        { $group: { _id: '$churchId' } },
        {
          $lookup: {
            from: 'churches',
            localField: '_id',
            foreignField: '_id',
            as: 'church',
          },
        },
        { $unwind: '$church' },
        { $project: { id: '$_id', name: '$church.name' } },
        { $sort: { name: 1 } },
      ]);
    }

    // Format member data for frontend
    const formattedMembers = members.map((member) => {
      const memberChurch = member.churchId as any as {
        _id: Types.ObjectId;
        name: string;
      };
      return {
        id: member._id,
        name: member.fullName,
        email: member.email,
        phone: member.phoneNumber,
        membershipStatus: member.membershipStatus,
        role: this.getMemberRoleFromStatus(member.membershipStatus),
        isActive: member.isActive,
        lastActive: member.updatedAt,
        churchId: memberChurch?._id,
        churchName: memberChurch?.name,
        churchInitials: this.getInitials(memberChurch?.name),
        churchInitBg: this.getRandomBgColor(),
        churchInitColor: 'text-white',
        dateJoined: member.dateJoined,
        gender: member.gender,
        createdAt: member.createdAt,
      };
    });

    return {
      data: formattedMembers,
      churches,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1,
      },
    };
  }

  async getMemberManagementStats(authUser: Admin) {
    const query: any = {};

    if (authUser.churchId) {
      query.churchId = authUser.churchId;
    }

    const [
      totalMembers,
      activeMembers,
      inactiveMembers,
      membersByChurch,
      membersByStatus,
      newMembersLast30Days,
      genderDistribution,
    ] = await Promise.all([
      this.memberModel.countDocuments(query),
      // Active members (isActive = true)
      this.memberModel.countDocuments({
        ...query,
        isActive: true,
      }),
      // Inactive members (isActive = false)
      this.memberModel.countDocuments({
        ...query,
        isActive: false,
      }),
      // Members by church (only for platform admins)
      !authUser.churchId
        ? this.memberModel.aggregate([
            { $match: query },
            { $group: { _id: '$churchId', count: { $sum: 1 } } },
            {
              $lookup: {
                from: 'churches',
                localField: '_id',
                foreignField: '_id',
                as: 'church',
              },
            },
            { $unwind: '$church' },
            { $project: { churchName: '$church.name', count: 1 } },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ])
        : Promise.resolve([]),
      // Members by membership status
      this.memberModel.aggregate([
        { $match: query },
        { $group: { _id: '$membershipStatus', count: { $sum: 1 } } },
      ]),
      // New members in last 30 days
      this.memberModel.countDocuments({
        ...query,
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      }),
      // Gender distribution
      this.memberModel.aggregate([
        { $match: query },
        { $group: { _id: '$gender', count: { $sum: 1 } } },
      ]),
    ]);

    return {
      totalMembers,
      activeMembers,
      inactiveMembers,
      newMembersLast30Days,
      membersByChurch: membersByChurch.map((c) => ({
        churchName: c.churchName,
        count: c.count,
      })),
      membersByStatus: membersByStatus.map((s) => ({
        status: s._id || 'UNKNOWN',
        count: s.count,
      })),
      genderDistribution: genderDistribution.map((g) => ({
        gender: g._id,
        count: g.count,
      })),
    };
  }

  async updateMemberStatus(
    authUser: Admin,
    memberId: string,
    isActive: boolean,
  ) {
    const query: any = { _id: new Types.ObjectId(memberId) };

    if (authUser.churchId) {
      query.churchId = authUser.churchId;
    }

    const member = await this.memberModel.findOne(query);

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    await this.memberModel.findByIdAndUpdate(memberId, {
      isActive,
      ...(!isActive
        ? { deactivatedAt: new Date() }
        : { reactivatedAt: new Date() }),
    });

    // Log activity
    await this.activityLogService.create(authUser, {
      action: isActive ? 'Activated Member' : 'Deactivated Member',
      module: ModuleSections.MEMBERS,
      details: `${isActive ? 'Activated' : 'Deactivated'} member: ${member.fullName}`,
    });

    // Send notification
    await this.notificationService.createNotification(member.churchId, {
      title: isActive ? 'Member Activated' : 'Member Deactivated',
      body: `${member.fullName} has been ${isActive ? 'activated' : 'deactivated'}.`,
      type: NotificationType.MEMBER,
    });

    return {
      success: true,
      message: `Member ${isActive ? 'activated' : 'deactivated'} successfully`,
      isActive,
    };
  }

  async getMemberDetailsForManagement(authUser: Admin, memberId: string) {
    const query: any = { _id: new Types.ObjectId(memberId) };

    if (authUser.churchId) {
      query.churchId = authUser.churchId;
    }

    const member = await this.memberModel
      .findOne(query)
      .populate('churchId', 'name email phone address')
      .lean();

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Get attendance statistics
    const attendanceStats =
      await this.attendanceService.getMemberAttendanceStatsFilter(memberId, 30);

    // Get recent attendance records
    const recentAttendance =
      await this.attendanceService.getMemberAttendanceFilter(
        memberId,
        5,
        0,
        undefined,
      );

    const memberChurch = member.churchId as any as {
      _id: Types.ObjectId;
      name: string;
      email: string;
      address: string;
      phone: string;
    };

    return {
      id: member._id,
      name: member.fullName,
      email: member.email,
      phone: member.phoneNumber,
      gender: member.gender,
      title: member.title,
      birthday: member.birthday,
      maritalStatus: member.maritalStatus,
      dateOfMarriage: member.dateOfMarriage,
      occupation: member.occupation,
      educationalBackground: member.educationalBackground,
      address: member.address,
      membershipStatus: member.membershipStatus,
      isActive: member.isActive,
      dateJoined: member.dateJoined,
      previousChurchMembership: member.previousChurchMembership,
      isBaptized: member.isBaptized,
      ministries: member.ministries,
      volunteerPreferences: member.volunteerPreferences,
      cellGroupName: member.cellGroupName,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      church: memberChurch
        ? {
            id: memberChurch._id,
            name: memberChurch.name,
            email: memberChurch.email,
            phone: memberChurch.phone,
            address: memberChurch.address,
          }
        : null,
      stats: {
        attendanceRate: attendanceStats?.attendanceRate || 0,
        totalServicesAttended: attendanceStats?.totalServicesAttended || 0,
        totalServicesMissed: attendanceStats?.totalServicesMissed || 0,
        totalEvaluated: attendanceStats?.totalEvaluated || 0,
      },
      recentAttendance:
        recentAttendance.attendances?.map((att: any) => ({
          date: att.date,
          status: att.status,
          serviceTitle: att.churchServiceId?.title,
          serviceType: att.churchServiceId?.type,
          recordedBy: att.recordedBy
            ? `${att.recordedBy.firstName} ${att.recordedBy.lastName}`
            : 'System',
        })) || [],
    };
  }

  async getMemberLimitStatus(authUser: Admin) {
    const churchId = authUser.churchId;

    // Get current member count
    const currentMembers = await this.memberModel.countDocuments({ churchId });

    // Get subscription and plan limit
    const subscription =
      await this.subscriptionService.getActiveSubscription(churchId);

    if (!subscription) {
      const defaultLimit = await this.subscriptionService.getPlanMemberLimit(
        PlanType.STARTER,
      );
      const percentage =
        defaultLimit > 0 ? (currentMembers / defaultLimit) * 100 : 0;

      return {
        currentMembers,
        limit: defaultLimit,
        percentage: Math.min(percentage, 100),
        isOverLimit: defaultLimit > 0 && currentMembers > defaultLimit,
        isWithinGracePeriod: false,
        gracePeriodEnds: null,
        planName: PlanType.STARTER,
        needsAction: false,
        isNearLimit: percentage >= 80 && percentage < 100,
        daysRemaining: null,
      };
    }

    // Get plan limit
    const planLimit = await this.subscriptionService.getPlanMemberLimit(
      subscription.plan,
    );
    const percentage = planLimit > 0 ? (currentMembers / planLimit) * 100 : 0;
    const isOverLimit = planLimit > 0 && currentMembers > planLimit;

    // Check grace period
    let isWithinGracePeriod = false;
    let daysRemaining = null;

    if (subscription.gracePeriodEndDate) {
      const now = new Date();
      isWithinGracePeriod = now < subscription.gracePeriodEndDate;

      if (isWithinGracePeriod) {
        const diff = subscription.gracePeriodEndDate.getTime() - now.getTime();
        daysRemaining = Math.ceil(diff / (1000 * 3600 * 24));
      }
    }

    // If over limit and no grace period set, start one
    if (isOverLimit && !subscription.gracePeriodEndDate) {
      const gracePeriodEndDate = new Date();
      gracePeriodEndDate.setDate(gracePeriodEndDate.getDate() + 7); // 7 days grace period

      await this.subscriptionService.updateGracePeriod(
        churchId,
        gracePeriodEndDate,
      );

      return {
        currentMembers,
        limit: planLimit,
        percentage: Math.min(percentage, 100),
        isOverLimit,
        isWithinGracePeriod: true,
        gracePeriodEnds: gracePeriodEndDate,
        planName: subscription.plan,
        needsAction: true,
        isNearLimit: false,
        daysRemaining: 7,
      };
    }

    // Determine if action is needed
    const needsAction = isOverLimit && isWithinGracePeriod;

    return {
      currentMembers,
      limit: planLimit,
      percentage: Math.min(percentage, 100),
      isOverLimit,
      isWithinGracePeriod,
      gracePeriodEnds: subscription.gracePeriodEndDate || null,
      planName: subscription.plan,
      needsAction,
      isNearLimit: percentage >= 80 && percentage < 100 && !isOverLimit,
      daysRemaining,
    };
  }

  private getMemberRoleFromStatus(status: MembershipStatus): string {
    const roleMap: Record<MembershipStatus, string> = {
      [MembershipStatus.LEADER]: 'Leader',
      [MembershipStatus.VOLUNTEER]: 'Volunteer',
      [MembershipStatus.WORKER]: 'Worker',
      [MembershipStatus.MEMBER]: 'Member',
      [MembershipStatus.VISITOR]: 'Visitor',
      [MembershipStatus.CONVERT]: 'New Convert',
    };
    return roleMap[status] || 'Member';
  }

  private getInitials(name: string): string {
    if (!name) {
      return 'CH';
    }
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  private getRandomBgColor(): string {
    const colors = [
      'bg-blue-500',
      'bg-green-500',
      'bg-amber-500',
      'bg-purple-500',
      'bg-pink-500',
      'bg-indigo-500',
      'bg-red-500',
      'bg-teal-500',
      'bg-orange-500',
      'bg-cyan-500',
      'bg-emerald-500',
      'bg-rose-500',
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
