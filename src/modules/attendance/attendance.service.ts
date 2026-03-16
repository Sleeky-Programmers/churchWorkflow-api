import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance } from '../../schemas/attendance.schema';
import { ChurchService } from '../../schemas/church-service.schema';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { MembersService } from '../members/members.service';
import { AttendanceStatus, Gender } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @InjectModel(ChurchService.name)
    private churchServiceModel: Model<ChurchService>,
    private membersService: MembersService,
  ) {}

  async markAttendance(
    adminId: Types.ObjectId,
    serviceId: string,
    createAttendanceDto: CreateAttendanceDto,
  ) {
    createAttendanceDto.memberIds.forEach(async (memberId) => {
      await this.attendanceModel.create({
        churchServiceId: serviceId,
        date: createAttendanceDto.date,
        memberId,
        recordedBy: adminId,
        status: AttendanceStatus.PRESENT,
      });
    });

    return {
      message: 'Attendance marked successfully',
    };
  }

  async getAttendance(authUser: Admin, churchServiceId: string, date: string) {
    const attendance = await this.attendanceModel
      .find({ churchServiceId, date })
      .lean();

    if (!attendance || attendance.length === 0) {
      return {
        attendance: null,
        stats: null,
      };
    }

    const presentIds = attendance.map((record) => record.memberId.toString());

    const members = await this.membersService.findAll(authUser);

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

  async getAttendanceStats(authUser: Admin) {
    const services = await this.churchServiceModel
      .find({ churchId: authUser.churchId })
      .select('_id')
      .lean();

    if (!services.length) {
      return { totalAttendance: 0 };
    }

    const serviceIds = services.map((service) => service._id);

    const totalAttendance = await this.attendanceModel.countDocuments({
      churchServiceId: { $in: serviceIds },
      status: AttendanceStatus.PRESENT,
    });

    return { totalAttendance };
  }
}
