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

    let rowIndex = 1;

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

          if (!row.gender) {
            rowErrors.push({
              column: 'gender',
              reason: 'Gender is required',
            });
          } else if (!Object.values(Gender).includes(row.gender)) {
            rowErrors.push({
              column: 'gender',
              reason: `Invalid gender "${row.gender}". Allowed values: ${Object.values(Gender).join(', ')}`,
            });
          }

          if (!row.birthday) {
            rowErrors.push({
              column: 'birthday',
              reason: 'Birthday is required',
            });
          }

          const birthday = row.birthday ? new Date(row.birthday) : null;
          if (row.birthday && isNaN(birthday.getTime())) {
            rowErrors.push({
              column: 'birthday',
              reason: 'Invalid birthday date format',
            });
          }

          const dateOfMarriage = row.dateOfMarriage
            ? new Date(row.dateOfMarriage)
            : null;

          if (row.dateOfMarriage && isNaN(dateOfMarriage.getTime())) {
            rowErrors.push({
              column: 'dateOfMarriage',
              reason: 'Invalid dateOfMarriage format',
            });
          }

          const dateJoined = row.dateJoined ? new Date(row.dateJoined) : null;

          if (row.dateJoined && isNaN(dateJoined.getTime())) {
            rowErrors.push({
              column: 'dateJoined',
              reason: 'Invalid dateJoined format',
            });
          }

          if (
            row.title &&
            !Object.values(MemberTitle).includes(row.title as MemberTitle)
          ) {
            rowErrors.push({
              column: 'title',
              reason: `Invalid title "${row.title}". Allowed values: ${Object.values(MemberTitle).join(', ')}`,
            });
          }

          if (
            row.maritalStatus &&
            !Object.values(MaritalStatus).includes(row.maritalStatus)
          ) {
            rowErrors.push({
              column: 'maritalStatus',
              reason: `Invalid maritalStatus "${row.maritalStatus}". Allowed values: ${Object.values(MaritalStatus).join(', ')}`,
            });
          }

          if (
            row.membershipStatus &&
            !Object.values(MembershipStatus).includes(row.membershipStatus)
          ) {
            rowErrors.push({
              column: 'membershipStatus',
              reason: `Invalid membershipStatus "${row.membershipStatus}". Allowed values: ${Object.values(MembershipStatus).join(', ')}`,
            });
          }

          let isBaptized: boolean | null = null;

          if (row.isBaptized !== undefined) {
            const value = row.isBaptized?.toLowerCase();

            if (value === 'true') isBaptized = true;
            else if (value === 'false') isBaptized = false;
            else {
              rowErrors.push({
                column: 'isBaptized',
                reason: 'isBaptized must be true or false',
              });
            }
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
            title: row.title || null,
            fullName: row.fullName?.trim(),
            gender: row.gender,
            birthday,
            maritalStatus: row.maritalStatus || null,
            dateOfMarriage,
            phoneNumber: row.phoneNumber?.trim(),
            email: row.email?.toLowerCase()?.trim(),
            occupation: row.occupation?.trim(),
            educationalBackground: row.educationalBackground?.trim(),
            membershipStatus: row.membershipStatus || null,
            dateJoined,
            previousChurchMembership: row.previousChurchMembership?.trim(),
            isBaptized,
            ministries: row.ministries?.trim(),
            volunteerPreferences: row.volunteerPreferences?.trim(),
            cellGroupName: row.cellGroupName?.trim(),
          };

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
    const createdMember = await this.memberModel.create({
      churchId: authUser.churchId,
      ...createMemberDto,
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
