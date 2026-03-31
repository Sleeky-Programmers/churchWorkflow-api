import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { AttendanceService } from '../attendance/attendance.service';
import { ChurchServicesService } from '../church-services/church-services.service';
import { Model, Types } from 'mongoose';
import {
  MemberAttendanceFilterDto,
  MemberAttendanceStatsFilterDto,
} from './dto/member-attendance-filter.dto';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Readable } from 'stream';
import { Member } from '../../schemas/member.schema';
import { MembersFilterDto } from '../../common/helpers/pagination.helper';
import {
  MemberFilter,
  Gender,
  MaritalStatus,
  MembershipStatus,
  MemberTitle,
  ModuleSections,
  NotificationType,
} from '../../common/utils/enums.utils';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { paginationMeta } from '../../common/helpers/pagination.helper';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationService } from '../notification/notification.service';
import { Admin } from '../../schemas/admin.schema';
const csv = require('csv-parser');

const TITLE_MAP: Record<string, MemberTitle> = {
  MR: MemberTitle.MR,
  'MR.': MemberTitle.MR,
  MRS: MemberTitle.MRS,
  'MRS.': MemberTitle.MRS,
  MISS: MemberTitle.MISS,
  'MISS.': MemberTitle.MISS,
  MS: MemberTitle.MISS,
  'MS.': MemberTitle.MISS,
  DR: MemberTitle.DR,
  'DR.': MemberTitle.DR,
  PASTOR: MemberTitle.PASTOR,
  'PASTOR.': MemberTitle.PASTOR,
  REV: MemberTitle.REV,
  'REV.': MemberTitle.REV,
};

const GENDER_MAP: Record<string, Gender> = {
  MALE: Gender.MALE,
  M: Gender.MALE,
  FEMALE: Gender.FEMALE,
  F: Gender.FEMALE,
};

const MARITAL_STATUS_MAP: Record<string, MaritalStatus | null> = {
  MARRIED: MaritalStatus.MARRIED,
  SINGLE: MaritalStatus.SINGLE,
  DIVORCED: null,
  WIDOWED: null,
};

const MEMBERSHIP_STATUS_MAP: Record<string, MembershipStatus> = {
  MEMBER: MembershipStatus.MEMBER,
  ACTIVE: MembershipStatus.MEMBER,
  'NEW MEMBER': MembershipStatus.MEMBER,
  VOLUNTEER: MembershipStatus.VOLUNTEER,
  LEADER: MembershipStatus.LEADER,
  VISITOR: MembershipStatus.VISITOR,
  INACTIVE: MembershipStatus.VISITOR,
};

function normalizeKey(value?: string) {
  return (value || '').trim().toUpperCase();
}

function parseOptionalDate(value?: string): Date | null {
  const normalized = (value || '').trim();
  if (!normalized) {
    return null;
  }
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function parseBoolean(value?: string): boolean | null {
  const normalized = normalizeKey(value);
  if (!normalized) {
    return null;
  }

  if (['TRUE', 'YES', '1'].includes(normalized)) {
    return true;
  }
  if (['FALSE', 'NO', '0'].includes(normalized)) {
    return false;
  }

  return null;
}

function normalizeText(value?: string): string {
  return (value || '').trim().toLowerCase();
}

function normalizeDateKey(value?: Date | string | null): string {
  if (!value) {
    return '';
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().split('T')[0];
}

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
  ) {}

  async getMemberAttendanceStats(
    id: string,
    dto: MemberAttendanceStatsFilterDto,
  ) {
    return await this.attendanceService.getMemberAttendanceStatsFilter(
      id,
      dto.days,
    );
  }

  async getMemberAttendance(id: string, dto: MemberAttendanceFilterDto) {
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
      serviceName: record.churchServiceId?.serviceName,
      serviceType: record.churchServiceId?.type,
      recordedBy: `${record.recordedBy.firstName} ${record.recordedBy.lastName}`,
      timestamp: record.createdAt,
    }));

    return {
      data: formattedData,
      pagination: paginationMeta({ page: page!, limit: limit!, itemCount }),
    };
  }

  async createMembersByCsv(authUser: Admin, fileBuffer: Buffer) {
    const members: Partial<Member>[] = [];
    const errors: { row: number; column?: string; reason: string }[] = [];
    const existingEmailSet = new Set<string>();
    const existingIdentitySet = new Set<string>();
    const batchEmailSet = new Set<string>();
    const batchIdentitySet = new Set<string>();

    let rowIndex = 1;

    const existingMembers = await this.memberModel
      .find({ churchId: authUser.churchId })
      .select('email fullName phoneNumber birthday')
      .lean();

    for (const member of existingMembers) {
      const emailKey = normalizeText(member.email);
      if (emailKey) {
        existingEmailSet.add(emailKey);
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
            churchId: authUser.churchId,
            ...dtoInstance,
          });

          if (emailKey) {
            batchEmailSet.add(emailKey);
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

  async addMember(authUser: Admin, createMemberDto: CreateMemberDto) {
    const payload = {
      ...createMemberDto,
      membershipStatus:
        createMemberDto.membershipStatus || MembershipStatus.MEMBER,
    };

    const createdMember = await this.memberModel.create({
      churchId: authUser.churchId,
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

  async getMemberStats(authUser: Admin) {
    const churchId = authUser.churchId;

    const totalMembers = await this.memberModel.countDocuments({ churchId });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const previousTotal = await this.memberModel.countDocuments({
      churchId,
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

  async getAllMembers(authUser: Admin, dto: MembersFilterDto) {
    const { page, limit, search, filter } = dto;

    const skip = (page - 1) * limit;

    const query: any = { churchId: authUser.churchId };

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
      this.memberModel.find(query).skip(skip).limit(limit),
      this.memberModel.countDocuments(query),
    ]);

    return {
      data: members,
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async findAll(authUser: Admin) {
    return await this.memberModel.find({ churchId: authUser.churchId });
  }

  async findByIdInChurch(memberId: string, churchId: Types.ObjectId) {
    return await this.memberModel
      .findOne({
        _id: memberId,
        churchId,
      })
      .select('_id fullName')
      .lean();
  }

  async countMembersInChurch(memberIds: string[], churchId: Types.ObjectId) {
    return await this.memberModel.countDocuments({
      _id: { $in: memberIds.map((id) => new Types.ObjectId(id)) },
      churchId,
    });
  }

  async existsInChurch(memberId: string, churchId: Types.ObjectId) {
    return await this.memberModel.exists({
      _id: new Types.ObjectId(memberId),
      churchId,
    });
  }

  async getMemberById(
    id: string,
    dto?: MemberAttendanceFilterDto,
  ): Promise<any> {
    const page = dto?.page || 1;
    const limit = dto?.limit || 10;

    const [member, attendanceStats, attendance] = await Promise.all([
      this.memberModel.findById(id).lean(),
      this.attendanceService.getMemberAttendanceStatsFilter(id),
      this.getMemberAttendance(id, { ...dto, page, limit }),
    ]);

    if (!member) {
      return null;
    }

    return {
      ...member,
      attendanceStats,
      attendanceList: attendance.data,
      attendancePagination: attendance.pagination,
    };
  }

  async updateMember(id: string, updateMemberDto: UpdateMemberDto) {
    return await this.memberModel.findByIdAndUpdate(id, updateMemberDto, {
      new: true,
    });
  }

  async deleteMember(id: string) {
    return await this.memberModel.findByIdAndDelete(id);
  }
}
