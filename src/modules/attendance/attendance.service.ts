import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import {
  AttendanceStatus,
  Gender,
  ServiceType,
} from '../../common/utils/enums.utils';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { Admin } from '../../schemas/admin.schema';
import { Attendance } from '../../schemas/attendance.schema';
import { AdminService } from '../admin/admin.service';
import { ChurchServicesService } from '../church-services/church-services.service';
import { MembersService } from '../members/members.service';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectModel(Attendance.name) private attendanceModel: Model<Attendance>,
    @Inject(forwardRef(() => MembersService))
    private membersService: MembersService,
    private churchServicesService: ChurchServicesService,
    @Inject(forwardRef(() => AdminService))
    private adminService: AdminService,
  ) {}

  private async replaceAttendanceByStatus(
    authUser: Admin,
    tenant: TenantContext,
    serviceId: string,
    createAttendanceDto: CreateAttendanceDto,
    status: AttendanceStatus,
  ) {
    const service = await this.churchServicesService.findOneInChurch(
      serviceId,
      tenant,
    );

    if (!service) {
      throw new NotFoundException('Service not found');
    }

    const attendanceDate = this.normalizeDate(createAttendanceDto.date);

    if (
      !this.churchServicesService.isServiceScheduledOn(service, attendanceDate)
    ) {
      throw new BadRequestException(
        'This service is not scheduled on the selected date',
      );
    }

    const [year, month, day] = attendanceDate.split('-').map(Number);
    const attendanceDateObj = new Date(year, month - 1, day);
    attendanceDateObj.setHours(0, 0, 0, 0);

    const now = new Date();

    const todayObj = new Date(now);
    todayObj.setHours(0, 0, 0, 0);

    if (attendanceDateObj.getTime() > todayObj.getTime()) {
      throw new BadRequestException(
        'Cannot mark attendance for a future service',
      );
    }

    if (attendanceDateObj.getTime() === todayObj.getTime()) {
      let startTimeStr: string | undefined;

      if (service?.specialDays?.length) {
        const matched = service.specialDays.find((specialDay: any) => {
          if (!specialDay?.date) {
            return false;
          }

          const specialDate = this.normalizeDate(specialDay.date);
          return specialDate === attendanceDate;
        });

        if (matched?.startTime) {
          startTimeStr = matched.startTime;
        }
      }

      if (!startTimeStr) {
        startTimeStr = service?.startTime;
      }

      if (startTimeStr) {
        const serviceDateTime = this.combineDateAnd12HourTime(
          attendanceDateObj,
          startTimeStr,
        );

        if (serviceDateTime.getTime() > now.getTime()) {
          throw new BadRequestException(
            'Cannot mark attendance for a future service',
          );
        }
      }
    }

    let memberIds = createAttendanceDto.memberIds || [];

    if (createAttendanceDto.isAllPresent) {
      const members = await this.membersService.findAll(tenant);
      memberIds = members.map((member) => member._id.toString());
    }

    await this.attendanceModel.deleteMany({
      churchServiceId: new Types.ObjectId(serviceId),
      status,
      date: attendanceDate,
    });

    if (!memberIds.length) {
      return;
    }

    await this.attendanceModel.insertMany(
      memberIds.map((memberId) => ({
        churchServiceId: new Types.ObjectId(serviceId),
        churchId: tenant.churchId,
        branchId: tenant.branchId,
        date: attendanceDate,
        memberId: new Types.ObjectId(memberId),
        recordedBy: authUser._id,
        status,
      })),
    );
  }

  private normalizeDate(dateString: string): string {
    if (!dateString) {
      throw new BadRequestException('Date is required');
    }

    const parts = dateString.split('T')[0].split('-');

    if (parts.length !== 3) {
      throw new BadRequestException('Invalid date format');
    }

    const [year, month, day] = parts.map(Number);

    if (!year || !month || !day) {
      throw new BadRequestException('Invalid date values');
    }

    return `${year.toString().padStart(4, '0')}-${month
      .toString()
      .padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  }

  private combineDateAnd12HourTime(baseDate: Date, timeString: string): Date {
    const match = timeString.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);

    if (!match) {
      throw new BadRequestException(`Invalid time format: ${timeString}`);
    }

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const meridian = match[3].toUpperCase();

    if (meridian === 'AM' && hours === 12) {
      hours = 0;
    }

    if (meridian === 'PM' && hours !== 12) {
      hours += 12;
    }

    const result = new Date(baseDate);
    result.setHours(hours, minutes, 0, 0);

    return result;
  }

  async markAttendance(
    authUser: Admin,
    tenant: TenantContext,
    serviceId: string,
    createAttendanceDto: CreateAttendanceDto,
  ) {
    await this.replaceAttendanceByStatus(
      authUser,
      tenant,
      serviceId,
      createAttendanceDto,
      AttendanceStatus.PRESENT,
    );

    return {
      message: 'Attendance marked successfully',
    };
  }

  async markAsAbsent(
    authUser: Admin,
    tenant: TenantContext,
    serviceId: string,
    createAttendanceDto: CreateAttendanceDto,
  ) {
    await this.replaceAttendanceByStatus(
      authUser,
      tenant,
      serviceId,
      createAttendanceDto,
      AttendanceStatus.ABSENT,
    );

    return {
      message: 'Attendance marked as absent successfully',
    };
  }

  async getAttendance(
    tenant: TenantContext,
    churchServiceId: string,
    date: string,
  ) {
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

    const members = await this.membersService.findAll(tenant);

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

  async getAttendanceStats(tenant: TenantContext) {
    const serviceIds =
      await this.churchServicesService.getServiceIdsByChurchId(tenant);

    if (!serviceIds.length) {
      return { totalAttendance: 0 };
    }

    const totalAttendance = await this.attendanceModel.countDocuments({
      churchServiceId: { $in: serviceIds },
      status: AttendanceStatus.PRESENT,
    });

    return { totalAttendance };
  }

  async getAttendanceTrend(tenant: TenantContext, year?: number) {
    const serviceIdsAndTypes =
      await this.churchServicesService.findByChurchId(tenant);

    if (!serviceIdsAndTypes?.length) {
      return { regularService: [], specialService: [] };
    }

    const serviceTypeMap = new Map<string, string>();
    const serviceIds = serviceIdsAndTypes.map((service: any) => {
      serviceTypeMap.set(service._id.toString(), service.type);
      return service._id;
    });

    const targetYear = year || new Date().getFullYear();

    const attendances = await this.attendanceModel
      .find({
        churchServiceId: { $in: serviceIds },
        status: AttendanceStatus.PRESENT,
      })
      .select('churchServiceId date')
      .lean();

    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const regularCounts = new Array(12).fill(0);
    const specialCounts = new Array(12).fill(0);

    for (const record of attendances) {
      const serviceId = record.churchServiceId?.toString?.();
      if (!serviceId) {
        continue;
      }
      const serviceType = serviceTypeMap.get(serviceId) || ServiceType.REGULAR;

      const date = new Date(record.date);
      if (isNaN(date.getTime())) {
        continue;
      }
      const year = date.getFullYear();
      if (year !== targetYear) {
        continue;
      }
      const month = date.getMonth();

      if (serviceType === ServiceType.SPECIAL) {
        specialCounts[month]++;
      } else {
        regularCounts[month]++;
      }
    }

    const regularService = regularCounts.map((total, index) => ({
      month: monthNames[index],
      totalAttendance: total,
    }));

    const specialService = specialCounts.map((total, index) => ({
      month: monthNames[index],
      totalAttendance: total,
    }));

    return { regularService, specialService };
  }

  async getMemberAttendanceHistory(
    tenant: TenantContext,
    memberId: string,
    from?: string,
    to?: string,
  ) {
    if (!Types.ObjectId.isValid(memberId)) {
      throw new BadRequestException('Invalid member id');
    }

    const member = await this.membersService.findByIdInChurch(memberId, tenant);

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    const services = await this.churchServicesService.findByChurchId(tenant);

    const serviceMap = new Map(
      services.map((service: any) => [service._id.toString(), service.title]),
    );
    const serviceIds = services.map((service: any) => service._id);

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
      if (from) {
        dateQuery.date.$gte = new Date(from);
      }
      if (to) {
        dateQuery.date.$lte = new Date(to);
      }
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
      ? await this.adminService.findNamesByIds(recordedByIds)
      : [];

    const adminNameMap = new Map(
      admins.map((admin: any) => [
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
        if (a.date === b.date) {
          return a.service.localeCompare(b.service);
        }
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
      if (record.status === 'Present') {
        current.attended += 1;
      }
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

  async getMemberAttendanceStatsFilter(memberId: string, days?: number) {
    const query: any = { memberId: new Types.ObjectId(memberId) };

    if (days) {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - days);
      query.date = { $gte: pastDate };
    }

    const [present, absent] = await Promise.all([
      this.attendanceModel.countDocuments({
        ...query,
        status: AttendanceStatus.PRESENT,
      }),
      this.attendanceModel.countDocuments({
        ...query,
        status: AttendanceStatus.ABSENT,
      }),
    ]);

    const totalServices = present + absent;

    let percentage = 0;
    if (totalServices > 0) {
      percentage = Math.round((present / totalServices) * 100);
    }

    return {
      totalServicesAttended: present,
      totalServicesMissed: absent,
      attendanceRate: percentage,
      totalEvaluated: totalServices,
    };
  }

  async getMemberAttendanceFilter(
    memberId: string,
    limit: number,
    skip: number,
    serviceIds?: Types.ObjectId[],
  ) {
    const query: any = { memberId: new Types.ObjectId(memberId) };

    if (serviceIds?.length) {
      query.churchServiceId = { $in: serviceIds };
    }

    const [attendances, itemCount] = await Promise.all([
      this.attendanceModel
        .find(query)
        .populate('churchServiceId', 'title type')
        .populate('recordedBy', 'firstName lastName')
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      this.attendanceModel.countDocuments(query),
    ]);

    return { attendances, itemCount };
  }

  async replaceTeamAttendanceForServiceDate(
    serviceId: string,
    attendanceDate: Date,
    teamMemberIds: Types.ObjectId[],
    presentMemberIds: string[],
    recordedBy: Types.ObjectId,
  ) {
    await this.attendanceModel.deleteMany({
      churchServiceId: new Types.ObjectId(serviceId),
      date: attendanceDate,
      memberId: { $in: teamMemberIds },
    });

    if (presentMemberIds.length === 0) {
      return;
    }

    await this.attendanceModel.insertMany(
      presentMemberIds.map((memberId) => ({
        churchServiceId: new Types.ObjectId(serviceId),
        date: attendanceDate,
        memberId: new Types.ObjectId(memberId),
        recordedBy,
        status: AttendanceStatus.PRESENT,
      })),
    );
  }

  async getPresentAttendanceByMemberIds(
    memberIds: string[],
    from?: string,
    to?: string,
  ) {
    const dateFilter: any = {};
    if (from || to) {
      dateFilter.date = {};
      if (from) {
        dateFilter.date.$gte = new Date(from);
      }
      if (to) {
        dateFilter.date.$lte = new Date(to);
      }
    }

    return await this.attendanceModel
      .find({
        memberId: {
          $in: memberIds.map((memberId) => new Types.ObjectId(memberId)),
        },
        status: AttendanceStatus.PRESENT,
        ...dateFilter,
      })
      .lean();
  }

  async countDistinctPresentMembers(days?: number) {
    const match: any = { status: AttendanceStatus.PRESENT };
    if (days) {
      const since = new Date();
      since.setDate(since.getDate() - days);
      match.date = { $gte: since };
    }

    const res = await this.attendanceModel.aggregate([
      { $match: match },
      { $group: { _id: '$memberId' } },
      { $count: 'count' },
    ]);

    return (res[0]?.count as number) || 0;
  }

  async countDistinctPresentMembersBetween(from?: string, to?: string) {
    const match: any = { status: AttendanceStatus.PRESENT };

    if (from || to) {
      match.date = {};
      if (from) {
        match.date.$gte = new Date(from);
      }
      if (to) {
        match.date.$lt = new Date(to);
      }
    }

    const res = await this.attendanceModel.aggregate([
      { $match: match },
      { $group: { _id: '$memberId' } },
      { $count: 'count' },
    ]);

    return (res[0]?.count as number) || 0;
  }

  async getPlatformWideAttendanceCount(
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.attendanceModel.aggregate([
      {
        $match: {
          status: AttendanceStatus.PRESENT,
          date: {
            $gte: startDate.toISOString(),
            $lt: endDate.toISOString(),
          },
        },
      },
      {
        $group: {
          _id: null,
          uniqueMembers: { $addToSet: '$memberId' },
        },
      },
      {
        $project: {
          count: { $size: '$uniqueMembers' },
        },
      },
    ]);

    return result.length > 0 ? result[0].count : 0;
  }

  // Add this method - Get attendance trend across ALL churches by month
  async getPlatformWideAttendanceTrend(year: number) {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];

    // First, get all attendance records for the year
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);

    const attendances = await this.attendanceModel
      .find({
        status: AttendanceStatus.PRESENT,
        date: {
          $gte: startDate.toISOString(),
          $lte: endDate.toISOString(),
        },
      })
      .select('date churchServiceId')
      .lean();

    // Get all church services to determine their types
    const serviceIds = [
      ...new Set(
        attendances.map((a) => a.churchServiceId?.toString()).filter(Boolean),
      ),
    ];
    const services = await this.churchServicesService.findByIds(serviceIds);
    const serviceTypeMap = new Map(
      services.map((s) => [s._id.toString(), s.type]),
    );

    // Initialize counters for each month
    const regularCounts = new Array(12).fill(0);
    const specialCounts = new Array(12).fill(0);

    // Count attendance by month and service type
    for (const record of attendances) {
      const serviceId = record.churchServiceId?.toString();
      if (!serviceId) {
        continue;
      }

      const serviceType = serviceTypeMap.get(serviceId) || ServiceType.REGULAR;
      const date = new Date(record.date);
      if (isNaN(date.getTime())) {
        continue;
      }

      const recordYear = date.getFullYear();
      if (recordYear !== year) {
        continue;
      }

      const month = date.getMonth();

      if (serviceType === ServiceType.SPECIAL) {
        specialCounts[month]++;
      } else {
        regularCounts[month]++;
      }
    }

    const regularService = regularCounts.map((total, index) => ({
      month: monthNames[index],
      totalAttendance: total,
    }));

    const specialService = specialCounts.map((total, index) => ({
      month: monthNames[index],
      totalAttendance: total,
    }));

    return { regularService, specialService };
  }

  // Alternative: Get unique member attendance per month (distinct members)
  async getPlatformWideUniqueMemberAttendanceTrend(year: number) {
    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const trendData = [];

    for (let month = 0; month < 12; month++) {
      const startDate = new Date(year, month, 1);
      const endDate = new Date(year, month + 1, 1);

      const uniqueMembers = await this.attendanceModel.aggregate([
        {
          $match: {
            status: AttendanceStatus.PRESENT,
            date: {
              $gte: startDate.toISOString(),
              $lt: endDate.toISOString(),
            },
          },
        },
        {
          $group: {
            _id: '$memberId',
          },
        },
        {
          $count: 'count',
        },
      ]);

      const previousMonthStart = new Date(year, month - 1, 1);
      const previousMonthEnd = new Date(year, month, 1);

      const previousUniqueMembers =
        month > 0
          ? await this.attendanceModel.aggregate([
              {
                $match: {
                  status: AttendanceStatus.PRESENT,
                  date: {
                    $gte: previousMonthStart.toISOString(),
                    $lt: previousMonthEnd.toISOString(),
                  },
                },
              },
              {
                $group: {
                  _id: '$memberId',
                },
              },
              {
                $count: 'count',
              },
            ])
          : [{ count: 0 }];

      trendData.push({
        month: monthNames[month],
        thisMonth: uniqueMembers[0]?.count || 0,
        lastMonth: previousUniqueMembers[0]?.count || 0,
      });
    }

    return trendData;
  }
}
