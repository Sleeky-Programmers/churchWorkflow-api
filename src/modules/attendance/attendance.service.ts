import {
  Injectable,
  Inject,
  forwardRef,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance } from '../../schemas/attendance.schema';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { MembersService } from '../members/members.service';
import { ChurchServicesService } from '../church-services/church-services.service';
import { AttendanceStatus, Gender } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @Inject(forwardRef(() => MembersService))
    private membersService: MembersService,
    private churchServicesService: ChurchServicesService,
  ) {}

  async markAttendance(
    authUser: Admin,
    serviceId: string,
    createAttendanceDto: CreateAttendanceDto,
  ) {
    if (createAttendanceDto.isAllPresent) {
      const members = await this.membersService.findAll(authUser);
      const memberIds = members.map((member) => member._id.toString());
      createAttendanceDto.memberIds = memberIds;
    }
    const recordedBy = `${authUser.firstName} ${authUser.lastName}`;

    createAttendanceDto.memberIds.forEach(async (memberId) => {
      await this.attendanceModel.create({
        churchServiceId: serviceId,
        date: createAttendanceDto.date,
        memberId,
        recordedBy: recordedBy,
        status: AttendanceStatus.PRESENT,
      });
    });

    return {
      message: 'Attendance marked successfully',
    };
  }

  async markAsAbsent(
    authUser: Admin,
    serviceId: string,
    createAttendanceDto: CreateAttendanceDto,
  ) {
    if (!createAttendanceDto.memberIds) {
      throw new NotFoundException('Members not found');
    }
     const recordedBy = `${authUser.firstName} ${authUser.lastName}`;
    createAttendanceDto.memberIds.forEach(async (memberId) => {
      await this.attendanceModel.create({
        churchServiceId: serviceId,
        date: createAttendanceDto.date,
        memberId,
        recordedBy: recordedBy,
        status: AttendanceStatus.ABSENT,
      });
    });

    return {
      message: 'Attendance marked as absent successfully',
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

    const presentIds = attendance
      .filter((record) => record.status === AttendanceStatus.PRESENT)
      .map((record) => record.memberId.toString());

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
    const serviceIds = await this.churchServicesService.getServiceIdsByChurchId(
      authUser.churchId,
    );

    if (!serviceIds.length) {
      return { totalAttendance: 0 };
    }

    const totalAttendance = await this.attendanceModel.countDocuments({
      churchServiceId: { $in: serviceIds },
      status: AttendanceStatus.PRESENT,
    });

    return { totalAttendance };
  }

  async getMemberAttendanceStatsFilter(memberId: string, days?: number) {
    const query: any = { memberId: new Types.ObjectId(memberId) };

    if (days) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - days);
      query.date = { $gte: pastDate };
    }

    const attendances = await this.attendanceModel.find(query).lean();

    const totalServicesAttended = attendances.filter(
      (attendance) => attendance.status === AttendanceStatus.PRESENT,
    ).length;
    const totalServicesMissed = attendances.filter(
      (attendance) => attendance.status === AttendanceStatus.ABSENT,
    ).length;
    const totalServices = attendances.length;

    let percentage = 0;
    if (totalServices > 0) {
      percentage = Math.round((totalServicesAttended / totalServices) * 100);
    }

    return {
      totalServicesAttended,
      totalServicesMissed,
      attendanceRate: percentage,
      totalEvaluated: totalServices,
    };
  }

  async getMemberAttendanceFilter(
    memberId: string,
    limit: number,
    skip: number,
    serviceIds?: any,
  ) {
    const query: any = { memberId: new Types.ObjectId(memberId) };

    if (serviceIds) {
      query.churchServiceId = { $in: serviceIds };
    }

    const [attendances, itemCount] = await Promise.all([
      this.attendanceModel
        .find(query)
        .populate('churchServiceId', 'serviceName type')
        .populate('recordedBy', 'firstName lastName')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      this.attendanceModel.countDocuments(query),
    ]);

    return { attendances, itemCount };
  }
}
