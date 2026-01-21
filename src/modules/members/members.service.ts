import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Member } from '../../schemas/member.schema';
import { Readable } from 'stream';
import {
  Gender,
  MaritalStatus,
  MembershipStatus,
} from '../../common/utils/enums.utils';
const csv = require('csv-parser');

@Injectable()
export class MembersService {
  constructor(
    @InjectModel(Member.name)
    private memberModel: Model<Member>,
  ) {}

  async createMembersByCsv(fileBuffer: Buffer) {
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

    await this.memberModel.insertMany(members, { ordered: false });

    return { inserted: members.length, skipped: errors.length, errors };
  }
}
