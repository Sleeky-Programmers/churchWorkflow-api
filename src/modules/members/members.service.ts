import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Readable } from 'stream';
import { Member } from '../../schemas/member.schema';
import {
  Gender,
  MaritalStatus,
  MembershipStatus,
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
          const gender: Gender | undefined = Object.values(Gender).includes(
            row.gender as Gender,
          )
            ? (row.gender as Gender)
            : undefined;

          const maritalStatus: MaritalStatus | undefined = Object.values(
            MaritalStatus,
          ).includes(row.maritalStatus as MaritalStatus)
            ? (row.maritalStatus as MaritalStatus)
            : undefined;

          const membershipStatus: MembershipStatus | undefined = Object.values(
            MembershipStatus,
          ).includes(row.membershipStatus as MembershipStatus)
            ? (row.membershipStatus as MembershipStatus)
            : undefined;

          const birthday = row.birthday ? new Date(row.birthday) : null;
          const dateOfMarriage = row.dateOfMarriage
            ? new Date(row.dateOfMarriage)
            : null;
          const dateJoined = row.dateJoined ? new Date(row.dateJoined) : null;

          members.push({
            churchId: authUser.churchId,
            title: row.title?.trim(),
            fullName: row.fullName.trim(),
            gender,
            birthday,
            maritalStatus,
            dateOfMarriage,
            spouseFirstName: row.spouseFirstName?.trim(),
            spouseLastName: row.spouseLastName?.trim(),
            phoneNumber: row.phoneNumber?.trim(),
            email: row.email.toLowerCase().trim(),
            occupation: row.occupation?.trim(),
            educationalBackground: row.educationalBackground?.trim(),
            membershipStatus,
            dateJoined,
            previousChurchMembership: row.previousChurchMembership?.trim(),
            isBaptized: row.isBaptized?.toLowerCase() === 'true',
            ministries: row.ministries?.trim(),
            volunteerPreferences: row.volunteerPreferences?.trim(),
            cellGroupName: row.cellGroupName?.trim(),
          });
        } catch (err: any) {
          errors.push({ row: rowIndex, reason: err.message });
        }
      }
    } catch (err) {
      throw new BadRequestException('Failed to parse CSV file');
    }

    if (!members.length) {
      throw new BadRequestException('CSV file is empty or invalid');
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

    return { inserted: members.length, skipped: errors.length, errors };
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

    const [members, total] = await Promise.all([
      this.memberModel.find().skip(skip).limit(limit).sort({ createdAt: -1 }),

      this.memberModel.countDocuments(),
    ]);

    return {
      data: members,
      pagination: paginationMeta({
        page,
        limit,
        itemCount: total,
      }),
    };
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
