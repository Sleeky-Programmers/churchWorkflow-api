import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Attendance } from '../../schemas/attendance.schema';
import { ChurchService } from '../../schemas/church-service.schema';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { MembersService } from '../members/members.service';
import { AttendanceStatus, Gender } from '../../common/utils/enums.utils';
import { Admin } from '../../schemas/admin.schema';
import { Member } from '../../schemas/member.schema';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @InjectModel(ChurchService.name)
    private churchServiceModel: Model<ChurchService>,
    @InjectModel(Member.name) private memberModel: Model<Member>,
    @InjectModel(Admin.name) private adminModel: Model<Admin>,
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

    return { totalAttendance };
  }

  async getMemberAttendanceHistory(
    authUser: Admin,
    memberId: string,
    from?: string,
    to?: string,
  ) {
    if (!Types.ObjectId.isValid(memberId)) {
      throw new BadRequestException('Invalid member id');
    }

    const member = await this.memberModel
      .findOne({ _id: memberId, churchId: authUser.churchId })
      .select('_id fullName')
      .lean();

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const services = await this.churchServiceModel
      .find({ churchId: authUser.churchId })
      .select('_id serviceName')
      .lean();

    const serviceMap = new Map(
      services.map((service) => [service._id.toString(), service.serviceName]),
    );
    const serviceIds = services.map((service) => service._id);

    if (!serviceIds.length) {
      return {
        memberId,
        records: [],
        stats: {
          attended: 0,
          missed: 0,
          total: 0,
          rate: 0,
        },
        trends: [],
      };
    }

    const dateQuery: any = {};
    if (from || to) {
      dateQuery.date = {};
      if (from) dateQuery.date.$gte = new Date(from);
      if (to) dateQuery.date.$lte = new Date(to);
    }

    const [allChurchAttendance, memberAttendance] = await Promise.all([
      this.attendanceModel
        .find({
          churchServiceId: { $in: serviceIds },
          status: AttendanceStatus.PRESENT,
          ...dateQuery,
        })
        .select('churchServiceId date recordedBy createdAt')
        .sort({ date: -1, createdAt: -1 })
        .lean(),
      this.attendanceModel
        .find({
          churchServiceId: { $in: serviceIds },
          memberId: new Types.ObjectId(memberId),
          status: AttendanceStatus.PRESENT,
          ...dateQuery,
        })
        .select('churchServiceId date recordedBy createdAt')
        .sort({ date: -1, createdAt: -1 })
        .lean<(Attendance & { createdAt: Date })[]>(),
    ]);

    const sessionMap = new Map<
      string,
      { serviceId: string; date: Date; recordedBy: string | null }
    >();

    for (const record of allChurchAttendance) {
      const serviceId = record.churchServiceId.toString();
      const day = new Date(record.date).toISOString().split('T')[0];
      const key = `${serviceId}|${day}`;
      if (!sessionMap.has(key)) {
        sessionMap.set(key, {
          serviceId,
          date: new Date(record.date),
          recordedBy: record.recordedBy?.toString?.() || null,
        });
      }
    }

    const memberAttendanceBySession = new Map<
      string,
      { createdAt: Date; recordedBy: string | null }
    >();

    for (const record of memberAttendance) {
      const serviceId = record.churchServiceId.toString();
      const day = new Date(record.date).toISOString().split('T')[0];
      const key = `${serviceId}|${day}`;
      memberAttendanceBySession.set(key, {
        createdAt: new Date(record.createdAt),
        recordedBy: record.recordedBy?.toString?.() || null,
      });
    }

    const records = Array.from(sessionMap.entries()).map(
      ([sessionKey, session]) => {
        const memberRecord = memberAttendanceBySession.get(sessionKey);
        return {
          sessionKey,
          session,
          memberRecord,
          recordedById: memberRecord?.recordedBy || session.recordedBy || null,
        };
      },
    );

    const recordedByIds = Array.from(
      new Set(
        records
          .map((record) => record.recordedById)
          .filter(Boolean)
          .map((id) => id as string),
      ),
    );

    const admins = recordedByIds.length
      ? await this.adminModel
          .find({
            _id: { $in: recordedByIds.map((id) => new Types.ObjectId(id)) },
          })
          .select('firstName lastName')
          .lean()
      : [];

    const adminNameMap = new Map(
      admins.map((admin) => [
        admin._id.toString(),
        `${admin.firstName || ''} ${admin.lastName || ''}`.trim(),
      ]),
    );

    const normalizedRecords = records
      .map((record, index) => {
        const status = record.memberRecord ? 'Present' : 'Absent';
        const recordedAt = record.memberRecord
          ? record.memberRecord.createdAt
          : record.session.date;

        return {
          id: `${record.sessionKey}-${index}`,
          service: serviceMap.get(record.session.serviceId) || 'Service',
          date: new Date(record.session.date).toISOString().split('T')[0],
          status,
          recordedBy:
            (record.recordedById && adminNameMap.get(record.recordedById)) ||
            'System',
          time: recordedAt.toISOString(),
        };
      })
      .sort((a, b) => {
        if (a.date === b.date) return a.service.localeCompare(b.service);
        return b.date.localeCompare(a.date);
      });

    const attended = normalizedRecords.filter(
      (record) => record.status === 'Present',
    ).length;
    const missed = normalizedRecords.length - attended;
    const rate = normalizedRecords.length
      ? Math.round((attended / normalizedRecords.length) * 100)
      : 0;

    const trendMap = new Map<string, { attended: number; total: number }>();
    for (const record of normalizedRecords) {
      const month = record.date.slice(0, 7);
      const current = trendMap.get(month) || { attended: 0, total: 0 };
      current.total += 1;
      if (record.status === 'Present') current.attended += 1;
      trendMap.set(month, current);
    }

    const trends = Array.from(trendMap.entries())
      .map(([month, value]) => ({
        month,
        attended: value.attended,
        total: value.total,
        rate: value.total
          ? Math.round((value.attended / value.total) * 100)
          : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return {
      memberId: member._id.toString(),
      records: normalizedRecords,
      stats: {
        attended,
        missed,
        total: normalizedRecords.length,
        rate,
      },
      trends,
    };
  }
}
