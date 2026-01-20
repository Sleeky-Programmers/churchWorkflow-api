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
    const errors: any[] = [];
    let rowIndex = 1;

    return new Promise((resolve, reject) => {
      Readable.from(fileBuffer)
        .pipe(csv())
        .on('data', (row: any) => {
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

            const membershipStatus: MembershipStatus | undefined =
              Object.values(MembershipStatus).includes(
                row.membershipStatus as MembershipStatus,
              )
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
          } catch (err) {
            errors.push({ row: rowIndex, reason: err.message });
          }
        })
        .on('end', async () => {
          if (!members.length) {
            return reject(
              new BadRequestException('CSV file is empty or invalid'),
            );
          }

          try {
            await this.memberModel.insertMany(members, { ordered: false });
          } catch (err) {
            // Could handle duplicate email errors here if needed
          }

          resolve({ inserted: members.length, skipped: errors.length, errors });
        })
        .on('error', reject);
    });
  }
}
