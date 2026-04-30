import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import { Admin } from '../../schemas/admin.schema';
import { CreateSmallTeamDto } from './dto/create-small-team.dto';
import { UpdateSmallTeamDto } from './dto/update-small-team.dto';
import { UpdateSmallTeamMembersDto } from './dto/update-small-team-members.dto';
import { SmallTeamStatus } from '../../common/utils/enums.utils';
import { MarkSmallTeamAttendanceDto } from './dto/mark-small-team-attendance.dto';
import { SmallTeamReportQueryDto } from './dto/small-team-report-query.dto';
import { SmallTeam } from '../../schemas/small-team.schema';
import { MembersService } from '../members/members.service';
import { AdminService } from '../admin/admin.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ChurchServicesService } from '../church-services/church-services.service';

@Injectable()
export class SmallTeamsService {
  constructor(
    @InjectModel(SmallTeam.name) private smallTeamModel: Model<SmallTeam>,
    private membersService: MembersService,
    private adminService: AdminService,
    private attendanceService: AttendanceService,
    private churchServicesService: ChurchServicesService,
  ) {}

  async create(authUser: Admin, dto: CreateSmallTeamDto) {
    const memberIds = this.toUniqueIds(dto.memberIds || []);
    await this.assertMembersInChurch(authUser, memberIds);
    await this.assertLeaderInChurch(authUser, dto.leaderId);

    const created = await this.smallTeamModel.create({
      churchId: authUser.churchId,
      name: dto.name.trim(),
      leaderId: dto.leaderId || null,
      memberIds,
      status: dto.status || SmallTeamStatus.ACTIVE,
      description: dto.description || '',
    });

    return this.findById(authUser, created._id.toString());
  }

  async findAll(authUser: Admin, dto: PaginationBaseDto) {
    const { page = 1, limit = 20, search } = dto;
    const skip = (page - 1) * limit;

    const query: FilterQuery<SmallTeam> = {
      churchId: authUser.churchId,
    };

    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }

    const [teams, itemCount] = await Promise.all([
      this.smallTeamModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('leaderId', 'firstName lastName')
        .populate('memberIds', 'fullName email')
        .lean(),
      this.smallTeamModel.countDocuments(query),
    ]);

    return {
      data: teams.map((team) => this.toTeamResponse(team)),
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async findById(authUser: Admin, id: string) {
    const team = await this.smallTeamModel
      .findOne({ _id: id, churchId: authUser.churchId })
      .populate('leaderId', 'fullName')
      .populate('memberIds', 'fullName email')
      .lean();

    if (!team) {
      throw new NotFoundException('Small team not found');
    }

    return this.toTeamResponse(team);
  }

  async update(authUser: Admin, id: string, dto: UpdateSmallTeamDto) {
    const existing = await this.smallTeamModel.findOne({
      _id: id,
      churchId: authUser.churchId,
    });
    if (!existing) {
      throw new NotFoundException('Small team not found');
    }

    const updatePayload: Partial<SmallTeam> = {};

    if (typeof dto.name === 'string') {
      updatePayload.name = dto.name.trim();
    }

    if (dto.status) {
      updatePayload.status = dto.status;
    }

    if (typeof dto.description === 'string') {
      updatePayload.description = dto.description;
    }

    if (dto.leaderId !== undefined) {
      await this.assertLeaderInChurch(authUser, dto.leaderId);
      updatePayload.leaderId = dto.leaderId
        ? new Types.ObjectId(dto.leaderId)
        : null;
    }

    if (dto.memberIds) {
      const memberIds = this.toUniqueIds(dto.memberIds);
      await this.assertMembersInChurch(authUser, memberIds);
      updatePayload.memberIds = memberIds.map(
        (memberId) => new Types.ObjectId(memberId),
      );
    }

    await this.smallTeamModel.updateOne(
      { _id: id, churchId: authUser.churchId },
      updatePayload,
    );

    return this.findById(authUser, id);
  }

  async updateMembers(
    authUser: Admin,
    id: string,
    dto: UpdateSmallTeamMembersDto,
  ) {
    const team = await this.smallTeamModel.findOne({
      _id: id,
      churchId: authUser.churchId,
    });
    if (!team) {
      throw new NotFoundException('Small team not found');
    }

    const memberIds = this.toUniqueIds(dto.memberIds);
    await this.assertMembersInChurch(authUser, memberIds);

    team.memberIds = memberIds.map((memberId) => new Types.ObjectId(memberId));
    await team.save();

    return this.findById(authUser, id);
  }

  async delete(authUser: Admin, id: string) {
    const deleted = await this.smallTeamModel.findOneAndDelete({
      _id: id,
      churchId: authUser.churchId,
    });
    if (!deleted) {
      throw new NotFoundException('Small team not found');
    }

    return { message: 'Small team deleted successfully' };
  }

  async markAttendance(
    authUser: Admin,
    id: string,
    serviceId: string,
    dto: MarkSmallTeamAttendanceDto,
  ) {
    const team = await this.smallTeamModel.findOne({
      _id: id,
      churchId: authUser.churchId,
    });
    if (!team) {
      throw new NotFoundException('Small team not found');
    }

    const service = await this.churchServicesService.findOneInChurch(
      serviceId,
      authUser.churchId,
    );

    if (!service) {
      throw new BadRequestException('Service not found');
    }

    const teamMemberIds = team.memberIds.map((memberId) => memberId.toString());
    const memberIds = this.toUniqueIds(dto.memberIds);
    const invalidSelections = memberIds.filter(
      (memberId) => !teamMemberIds.includes(memberId),
    );
    if (invalidSelections.length > 0) {
      throw new BadRequestException(
        'One or more selected members are not part of this team',
      );
    }

    const attendanceDate = new Date(dto.date);

    await this.attendanceService.replaceTeamAttendanceForServiceDate(
      serviceId,
      attendanceDate,
      team.memberIds as Types.ObjectId[],
      memberIds,
      authUser._id,
    );

    return {
      message: 'Team attendance saved successfully',
      presentCount: memberIds.length,
      totalTeamMembers: team.memberIds.length,
    };
  }

  async getReport(authUser: Admin, id: string, query: SmallTeamReportQueryDto) {
    const team = await this.smallTeamModel
      .findOne({ _id: id, churchId: authUser.churchId })
      .populate('memberIds', 'fullName email')
      .lean();
    if (!team) {
      throw new NotFoundException('Small team not found');
    }

    const memberIds = team.memberIds.map((member: any) =>
      member?._id ? member._id.toString() : member.toString(),
    );

    if (memberIds.length === 0) {
      return {
        team: this.toTeamResponse(team),
        attendancePercentage: 0,
        sessions: 0,
        lowAttendanceMembers: [],
      };
    }

    const attendance =
      await this.attendanceService.getPresentAttendanceByMemberIds(
        memberIds,
        query.from,
        query.to,
      );

    const sessionKeySet = new Set(
      attendance.map(
        (record) =>
          `${record.churchServiceId.toString()}_${new Date(record.date).toISOString().split('T')[0]}`,
      ),
    );
    const sessions = sessionKeySet.size;

    const presentCountByMember = new Map<string, number>();
    attendance.forEach((record) => {
      const key = record.memberId.toString();
      presentCountByMember.set(key, (presentCountByMember.get(key) || 0) + 1);
    });

    const denominator = sessions * memberIds.length;
    const attendancePercentage =
      denominator > 0 ? Math.round((attendance.length / denominator) * 100) : 0;
    const threshold = query.lowAttendanceThreshold ?? 50;

    const lowAttendanceMembers = (team.memberIds as any[])
      .map((member) => {
        const id = member._id.toString();
        const present = presentCountByMember.get(id) || 0;
        const percentage =
          sessions > 0 ? Math.round((present / sessions) * 100) : 0;
        return {
          id,
          fullName: member.fullName,
          email: member.email || '',
          presentCount: present,
          sessions,
          attendancePercentage: percentage,
        };
      })
      .filter((member) => member.attendancePercentage < threshold)
      .sort((a, b) => a.attendancePercentage - b.attendancePercentage);

    return {
      team: this.toTeamResponse(team),
      attendancePercentage,
      sessions,
      lowAttendanceMembers,
    };
  }

  private toUniqueIds(ids: string[]) {
    return Array.from(new Set(ids.filter(Boolean)));
  }

  private async assertMembersInChurch(authUser: Admin, memberIds: string[]) {
    if (!memberIds.length) {
      return;
    }

    const count = await this.membersService.countMembersInChurch(
      memberIds,
      authUser.churchId,
    );

    if (count !== memberIds.length) {
      throw new BadRequestException(
        'One or more members were not found in this church',
      );
    }
  }

  private async assertLeaderInChurch(authUser: Admin, leaderId?: string) {
    if (!leaderId) {
      return;
    }

    const leader = await this.adminService.existsInChurch(
      leaderId,
      authUser.churchId,
    );

    if (!leader) {
      throw new BadRequestException('Team leader was not found in this church');
    }
  }

  private toTeamResponse(team: any) {
    const members = Array.isArray(team.memberIds) ? team.memberIds : [];
    const memberList = members
      .filter((member: any) => member?._id)
      .map((member: any) => ({
        id: member._id.toString(),
        fullName: member.fullName,
        email: member.email || '',
      }));

    return {
      _id: team._id.toString(),
      name: team.name,
      status: team.status,
      description: team.description || '',
      leader: team.leaderId
        ? {
            id: team.leaderId._id?.toString?.() || team.leaderId.toString(),
            fullName:
              `${team.leaderId.firstName} ${team.leaderId.lastName}` || '',
          }
        : null,
      members: memberList,
      membersCount: members.length,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }
}
