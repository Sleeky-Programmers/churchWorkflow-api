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
    const attendanceDate = new Date(createAttendanceDto.date);

    await this.attendanceModel.deleteMany({
      churchServiceId: new Types.ObjectId(serviceId),
      date: attendanceDate,
    });

    if (createAttendanceDto.memberIds.length > 0) {
      await this.attendanceModel.insertMany(
        createAttendanceDto.memberIds.map((memberId) => ({
          churchServiceId: new Types.ObjectId(serviceId),
          date: attendanceDate,
          memberId: new Types.ObjectId(memberId),
          recordedBy: adminId,
          status: AttendanceStatus.PRESENT,
        })),
      );
    }

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

    const now = new Date();
    const rangeStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const monthlyAttendance = await this.attendanceModel.aggregate([
      {
        $match: {
          churchServiceId: { $in: serviceIds },
          status: AttendanceStatus.PRESENT,
          date: { $gte: rangeStart },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          total: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlyCountMap = new Map<string, number>(
      monthlyAttendance.map((entry) => [entry._id, entry.total]),
    );

    const toMonthKey = (date: Date) => {
      const month = `${date.getMonth() + 1}`.padStart(2, '0');
      return `${date.getFullYear()}-${month}`;
    };

    const monthlyAttendanceTrends = Array.from({ length: 6 }, (_, index) => {
      const targetDate = new Date(
        now.getFullYear(),
        now.getMonth() - (5 - index),
        1,
      );
      const previousDate = new Date(
        targetDate.getFullYear(),
        targetDate.getMonth() - 1,
        1,
      );
      const monthKey = toMonthKey(targetDate);
      const previousMonthKey = toMonthKey(previousDate);

      return {
        month: targetDate.toLocaleDateString('en-US', { month: 'short' }),
        thisMonth: monthlyCountMap.get(monthKey) || 0,
        lastMonth: monthlyCountMap.get(previousMonthKey) || 0,
      };
    });

    const currentMonthKey = toMonthKey(
      new Date(now.getFullYear(), now.getMonth(), 1),
    );
    const previousMonthKey = toMonthKey(
      new Date(now.getFullYear(), now.getMonth() - 1, 1),
    );
    const currentMonthCount = monthlyCountMap.get(currentMonthKey) || 0;
    const previousMonthCount = monthlyCountMap.get(previousMonthKey) || 0;

    const growthValue =
      previousMonthCount === 0
        ? currentMonthCount > 0
          ? 100
          : 0
        : ((currentMonthCount - previousMonthCount) / previousMonthCount) * 100;

    const attendanceGrowth =
      growthValue >= 0
        ? `+${growthValue.toFixed(0)}%`
        : `${growthValue.toFixed(0)}%`;

    return {
      totalAttendance,
      attendanceGrowth,
      monthlyAttendanceTrends,
    };
  }
}
