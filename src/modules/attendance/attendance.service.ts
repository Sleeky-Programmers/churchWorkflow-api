import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance } from '../../schemas/attendance.schema';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { MembersService } from '../members/members.service';
import { Gender } from '../../common/utils/enums.utils';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    private membersService: MembersService,
  ) {}

  async markAttendance(
    adminId: Types.ObjectId,
    serviceId: string,
    createAttendanceDto: CreateAttendanceDto,
  ) {
    return this.attendanceModel.findOneAndUpdate(
      {
        churchServiceId: serviceId,
        date: createAttendanceDto.date,
      },
      {
        attendees: createAttendanceDto.attendees,
        recordedBy: adminId,
      },
      { upsert: true, new: true },
    );
  }

  async getAttendance(churchServiceId: string, date: string) {
    const attendance = await this.attendanceModel
      .findOne({ churchServiceId, date })
      .lean();

    if (!attendance) {
      return {
        attendance: null,
        stats: null,
      };
    }

    const presentIds = attendance.attendees.map((id) => id.toString());

    const members = await this.membersService.findAll();

    let malePresent = 0;
    let femalePresent = 0;
    let maleAbsent = 0;
    let femaleAbsent = 0;

    for (const member of members) {
      const isPresent = presentIds.includes(member._id.toString());

      if (member.gender === Gender.MALE) {
        isPresent ? malePresent++ : maleAbsent++;
      }

      if (member.gender === Gender.FEMALE) {
        isPresent ? femalePresent++ : femaleAbsent++;
      }
    }

    return {
      attendance,
      stats: {
        present: {
          male: malePresent,
          female: femalePresent,
          total: malePresent + femalePresent,
        },
        absent: {
          male: maleAbsent,
          female: femaleAbsent,
          total: maleAbsent + femaleAbsent,
        },
      },
    };
  }
}
