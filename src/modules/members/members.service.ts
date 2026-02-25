import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Readable } from 'stream';
import { Member } from '../../schemas/member.schema';
import {
  MaritalStatus,
  MembershipStatus,
  MemberTitle,
  ModuleSections,
  NotificationType,
} from '../../common/utils/enums.utils';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { NotificationService } from '../notification/notification.service';
import { Admin } from '../../schemas/admin.schema';
const csv = require('csv-parser');

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(Member.name)
    private memberModel: Model<Member>,
    private readonly activityLogService: ActivityLogService,
    private readonly notificationService: NotificationService,
  ) {}

  async createMembersByCsv(authUser: Admin, fileBuffer: Buffer) {
    const members: Partial<Member>[] = [];
    const errors: { row: number; reason: string }[] = [];
    let rowIndex = 1;

    const stream = Readable.from(fileBuffer).pipe(csv());

    try {
      for await (const row of stream) {
        rowIndex++;

        try {
          const parsedData: CreateMemberDto = {
            title: Object.values(MemberTitle).includes(row.title as MemberTitle)
              ? (row.title as MemberTitle)
              : null,

            fullName: row.fullName?.trim(),

            gender: row.gender,

            birthday: row.birthday ? new Date(row.birthday) : null,

            maritalStatus: Object.values(MaritalStatus).includes(
              row.maritalStatus as MaritalStatus,
            )
              ? (row.maritalStatus as MaritalStatus)
              : null,

            dateOfMarriage: row.dateOfMarriage
              ? new Date(row.dateOfMarriage)
              : null,

            spouseFirstName: row.spouseFirstName?.trim(),
            spouseLastName: row.spouseLastName?.trim(),
            phoneNumber: row.phoneNumber?.trim(),
            email: row.email?.toLowerCase().trim(),
            occupation: row.occupation?.trim(),
            educationalBackground: row.educationalBackground?.trim(),

            membershipStatus: Object.values(MembershipStatus).includes(
              row.membershipStatus as MembershipStatus,
            )
              ? (row.membershipStatus as MembershipStatus)
              : null,

            dateJoined: row.dateJoined ? new Date(row.dateJoined) : null,
            previousChurchMembership: row.previousChurchMembership?.trim(),

            isBaptized:
              row.isBaptized?.toLowerCase() === 'true'
                ? true
                : row.isBaptized?.toLowerCase() === 'false'
                  ? false
                  : null,

            ministries: row.ministries?.trim(),
            volunteerPreferences: row.volunteerPreferences?.trim(),
            cellGroupName: row.cellGroupName?.trim(),
          };

          const dtoInstance = plainToInstance(CreateMemberDto, parsedData);
          const validationErrors = await validate(dtoInstance);

          if (validationErrors.length > 0) {
            const messages = validationErrors
              .map((err) => Object.values(err.constraints || {}).join(', '))
              .join('; ');

            errors.push({ row: rowIndex, reason: messages });
            continue;
          }

          members.push({
            churchId: authUser.churchId,
            ...dtoInstance,
          });
        } catch (err: any) {
          errors.push({ row: rowIndex, reason: err.message });
        }
      }
    } catch (err) {
      throw new BadRequestException('Failed to parse CSV file');
    }

    if (!members.length) {
      throw new BadRequestException(
        'CSV file is empty or contains no valid records',
      );
    }

    const insertedDocs = await this.memberModel.insertMany(members, {
      ordered: false,
    });

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
      skipped: errors.length,
      errors,
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

  async getAllMembers(paginationBaseDto: PaginationBaseDto) {
    const { page, limit } = paginationBaseDto;

    const skip = (page - 1) * limit;

    const [members, itemCount] = await Promise.all([
      this.memberModel.find().skip(skip).limit(limit).sort({ createdAt: -1 }),

      this.memberModel.countDocuments(),
    ]);

    return {
      data: members,
      pagination: paginationMeta({
        page,
        limit,
        itemCount,
      }),
    };
  }

  async findAll() {
    return await this.memberModel.find().lean();
  }

  async getMemberById(id: string) {
    return await this.memberModel.findById(id);
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
