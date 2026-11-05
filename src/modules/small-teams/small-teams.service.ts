import {
  BadRequestException,
  ForbiddenException,
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
import { Role } from '../../schemas/role.schema';
import { CreateSmallTeamDto } from './dto/create-small-team.dto';
import { UpdateSmallTeamDto } from './dto/update-small-team.dto';
import { UpdateSmallTeamMembersDto } from './dto/update-small-team-members.dto';
import {
  AccessLevel,
  ModuleSections,
  RoleType,
  SmallTeamStatus,
} from '../../common/utils/enums.utils';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { buildTenantFilter } from '../../common/utils/tenant-filter.util';
import { MarkSmallTeamAttendanceDto } from './dto/mark-small-team-attendance.dto';
import { SmallTeamReportQueryDto } from './dto/small-team-report-query.dto';
import { SmallTeam } from '../../schemas/small-team.schema';
import { MembersService } from '../members/members.service';
import { AdminService } from '../admin/admin.service';
import { AttendanceService } from '../attendance/attendance.service';
import { ChurchServicesService } from '../church-services/church-services.service';
import { searchRegex } from '../../common/helpers/regex.helper';

@Injectable()
export class SmallTeamsService {
  constructor(
    @InjectModel(SmallTeam.name) private smallTeamModel: Model<SmallTeam>,
    private membersService: MembersService,
    private adminService: AdminService,
    private attendanceService: AttendanceService,
    private churchServicesService: ChurchServicesService,
  ) {}

  // FULL_ACCESS to SMALL_TEAMS (e.g. Super Admin, or a custom role granted
  // It explicitly) can see/manage every team in the church. Anything less
  // (VIEW or MANAGE, which is what the built-in "Small Teams" leader role
  // Gets) is scoped to teams the admin actually leads - see
  // AssertCanAccessTeam and the leaderId filter in findAll.
  private hasFullSmallTeamsAccess(authUser: Admin): boolean {
    const role = authUser.churchRole as unknown as Role;
    if (!role) {
      return false;
    }
    if (role.type === RoleType.SYSTEM && role.roleName === 'Super Admin') {
      return true;
    }
    const perm = role.permissions?.find(
      (p) => p.moduleSection === ModuleSections.SMALL_TEAMS,
    );
    return perm?.accessLevel === AccessLevel.FULL_ACCESS;
  }

  private isTeamLeader(authUser: Admin, team: { leaderId?: any }): boolean {
    const leaderId =
      team.leaderId?._id?.toString?.() || team.leaderId?.toString?.();
    return !!leaderId && leaderId === authUser._id.toString();
  }

  private assertCanAccessTeam(authUser: Admin, team: { leaderId?: any }) {
    if (this.hasFullSmallTeamsAccess(authUser)) {
      return;
    }
    if (!this.isTeamLeader(authUser, team)) {
      throw new ForbiddenException('You can only manage teams you lead');
    }
  }

  async create(
    authUser: Admin,
    tenant: TenantContext,
    dto: CreateSmallTeamDto,
  ) {
    const memberIds = this.toUniqueIds(dto.memberIds || []);
    await this.assertMembersInChurch(tenant, memberIds);

    // LeaderId (an existing admin) and pendingLeaderEmail (an invite not yet
    // Accepted) are mutually exclusive - an explicit leaderId wins.
    const leaderId = dto.leaderId || null;
    if (leaderId) {
      await this.assertLeaderInChurch(authUser, leaderId);
    }

    const created = await this.smallTeamModel.create({
      churchId: tenant.churchId,
      branchId: tenant.branchId,
      name: dto.name.trim(),
      leaderId,
      pendingLeaderEmail: leaderId
        ? null
        : dto.pendingLeaderEmail?.toLowerCase().trim() || null,
      memberIds,
      status: dto.status || SmallTeamStatus.ACTIVE,
      description: dto.description || '',
    });

    return this.findById(authUser, tenant, created._id.toString());
  }

  async findAll(
    authUser: Admin,
    tenant: TenantContext,
    dto: PaginationBaseDto,
  ) {
    const { page = 1, limit = 20, search } = dto;
    const skip = (page - 1) * limit;

    const query: FilterQuery<SmallTeam> = buildTenantFilter(tenant);

    if (!this.hasFullSmallTeamsAccess(authUser)) {
      query.leaderId = authUser._id;
    }

    if (search) {
      query.name = searchRegex(search);
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

  async findById(authUser: Admin, tenant: TenantContext, id: string) {
    const team = await this.smallTeamModel
      .findOne({ _id: id, ...buildTenantFilter(tenant) })
      .populate('leaderId', 'firstName lastName')
      .populate('memberIds', 'fullName email')
      .lean();

    if (!team) {
      throw new NotFoundException('Small team not found');
    }

    this.assertCanAccessTeam(authUser, team);

    return this.toTeamResponse(team);
  }

  async update(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: UpdateSmallTeamDto,
  ) {
    const existing = await this.smallTeamModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!existing) {
      throw new NotFoundException('Small team not found');
    }

    this.assertCanAccessTeam(authUser, existing);

    // Changing who leads a team is an org-wide administrative action, not
    // Something a team's own leader can do to themselves or anyone else.
    // Compared against the CURRENT value rather than just "is the key
    // Present in the request body" - the edit form always resubmits both
    // Fields, so a team leader saving an unrelated change (name, members,
    // ...) must not get blocked just because leaderId/pendingLeaderEmail
    // Came back unchanged in the payload.
    const nextLeaderId =
      dto.leaderId !== undefined ? dto.leaderId || null : undefined;
    const currentLeaderId = existing.leaderId?.toString() || null;
    const leaderIdChanged =
      nextLeaderId !== undefined && nextLeaderId !== currentLeaderId;

    const nextPendingLeaderEmail =
      dto.pendingLeaderEmail !== undefined
        ? dto.pendingLeaderEmail?.toLowerCase().trim() || null
        : undefined;
    const pendingLeaderEmailChanged =
      nextPendingLeaderEmail !== undefined &&
      nextPendingLeaderEmail !== (existing.pendingLeaderEmail || null);

    if (
      (leaderIdChanged || pendingLeaderEmailChanged) &&
      !this.hasFullSmallTeamsAccess(authUser)
    ) {
      throw new ForbiddenException(
        'You do not have permission to change this team’s leader',
      );
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
      // An explicit leaderId (including clearing it) supersedes any
      // Still-pending "invite new leader" that was set earlier.
      updatePayload.pendingLeaderEmail = null;
    } else if (dto.pendingLeaderEmail !== undefined) {
      updatePayload.pendingLeaderEmail = dto.pendingLeaderEmail
        ? dto.pendingLeaderEmail.toLowerCase().trim()
        : null;
      updatePayload.leaderId = null;
    }

    if (dto.memberIds) {
      const memberIds = this.toUniqueIds(dto.memberIds);
      await this.assertMembersInChurch(tenant, memberIds, existing.memberIds);
      updatePayload.memberIds = memberIds.map(
        (memberId) => new Types.ObjectId(memberId),
      );
    }

    await this.smallTeamModel.updateOne(
      { _id: id, ...buildTenantFilter(tenant) },
      updatePayload,
    );

    return this.findById(authUser, tenant, id);
  }

  async updateMembers(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: UpdateSmallTeamMembersDto,
  ) {
    const team = await this.smallTeamModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!team) {
      throw new NotFoundException('Small team not found');
    }

    this.assertCanAccessTeam(authUser, team);

    const memberIds = this.toUniqueIds(dto.memberIds);
    await this.assertMembersInChurch(tenant, memberIds, team.memberIds);

    team.memberIds = memberIds.map((memberId) => new Types.ObjectId(memberId));
    await team.save();

    return this.findById(authUser, tenant, id);
  }

  async delete(tenant: TenantContext, id: string) {
    const deleted = await this.smallTeamModel.findOneAndDelete({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!deleted) {
      throw new NotFoundException('Small team not found');
    }

    return { message: 'Small team deleted successfully' };
  }

  async markAttendance(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    serviceId: string,
    dto: MarkSmallTeamAttendanceDto,
  ) {
    const team = await this.smallTeamModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!team) {
      throw new NotFoundException('Small team not found');
    }

    this.assertCanAccessTeam(authUser, team);

    const service = await this.churchServicesService.findOneInChurch(
      serviceId,
      tenant,
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

  async getReport(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    query: SmallTeamReportQueryDto,
  ) {
    const team = await this.smallTeamModel
      .findOne({ _id: id, ...buildTenantFilter(tenant) })
      .populate('memberIds', 'fullName email')
      .lean();
    if (!team) {
      throw new NotFoundException('Small team not found');
    }

    this.assertCanAccessTeam(authUser, team);

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

  /**
   * Called once an invited person actually becomes an admin. Any team still
   * waiting on that email as its leader gets linked automatically.
   */
  async resolvePendingLeader(
    churchId: Types.ObjectId,
    email: string,
    adminId: Types.ObjectId,
  ) {
    await this.smallTeamModel.updateMany(
      { churchId, pendingLeaderEmail: email.toLowerCase().trim() },
      { $set: { leaderId: adminId, pendingLeaderEmail: null } },
    );
  }

  private toUniqueIds(ids: string[]) {
    return Array.from(new Set(ids.filter(Boolean)));
  }

  /**
   * `currentIds` are the team's existing members: only newly added people are
   * checked against the guest rule, so a team that already holds a guest from
   * before this rule can still be edited (and the guest removed).
   */
  private async assertMembersInChurch(
    tenant: TenantContext,
    memberIds: string[],
    currentIds: Types.ObjectId[] = [],
  ) {
    if (!memberIds.length) {
      return;
    }

    const count = await this.membersService.countMembersInChurch(
      memberIds,
      tenant,
    );

    if (count !== memberIds.length) {
      throw new BadRequestException(
        'One or more members were not found in this church',
      );
    }

    // Guests stay basic: they can't be added to a small team.
    const existing = new Set(currentIds.map((id) => String(id)));
    await this.membersService.assertNoGuests(
      memberIds.filter((id) => !existing.has(String(id))),
      tenant,
    );
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
      pendingLeaderEmail: team.pendingLeaderEmail || null,
      members: memberList,
      membersCount: members.length,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    };
  }
}
