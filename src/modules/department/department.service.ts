import { Model, Types } from 'mongoose';

import { Workbook } from 'exceljs';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { paginationMeta } from '../../common/helpers/pagination.helper';
import {
  AccessLevel,
  DepartmentMemberAction,
  DepartmentStatus,
  ModuleSections,
  RoleType,
} from '../../common/utils/enums.utils';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { buildTenantFilter } from '../../common/utils/tenant-filter.util';
import { Admin } from '../../schemas/admin.schema';
import { Department } from '../../schemas/department.schema';
import { Role } from '../../schemas/role.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AdminService } from '../admin/admin.service';
import { MembersService } from '../members/members.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { DepartmentFilterDto } from './dto/department-filter.dto';
import { UpdateDepartmentMembersDto } from './dto/update-department-members.dto';
import { UpdateDepartmentStatusDto } from './dto/update-department-status.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectModel(Department.name) private departmentModel: Model<Department>,
    private membersService: MembersService,
    private adminService: AdminService,
    private activityLogService: ActivityLogService,
  ) {}

  // FULL_ACCESS to DEPARTMENTS (e.g. Super Admin, or a custom role granted
  // It explicitly) can see/manage every department in the church. Anything
  // Less (the built-in "Department Head" role gets MANAGE) is scoped to
  // Departments the admin actually heads - see assertCanAccessDepartment
  // And the hod/assistantHod filter in findAll.
  private hasFullDepartmentsAccess(authUser: Admin): boolean {
    const role = authUser.churchRole as unknown as Role;
    if (!role) {
      return false;
    }
    if (role.type === RoleType.SYSTEM && role.roleName === 'Super Admin') {
      return true;
    }
    const perm = role.permissions?.find(
      (p) => p.moduleSection === ModuleSections.DEPARTMENTS,
    );
    return perm?.accessLevel === AccessLevel.FULL_ACCESS;
  }

  private isDepartmentHead(
    authUser: Admin,
    department: { hod?: any; assistantHod?: any },
  ): boolean {
    const userId = authUser._id.toString();
    const hodId =
      department.hod?._id?.toString?.() || department.hod?.toString?.();
    const assistantId =
      department.assistantHod?._id?.toString?.() ||
      department.assistantHod?.toString?.();
    return hodId === userId || assistantId === userId;
  }

  private assertCanAccessDepartment(
    authUser: Admin,
    department: { hod?: any; assistantHod?: any },
  ) {
    if (this.hasFullDepartmentsAccess(authUser)) {
      return;
    }
    if (!this.isDepartmentHead(authUser, department)) {
      throw new ForbiddenException('You can only manage departments you head');
    }
  }

  // Checked church-wide, not branch-scoped - the ticket asks for uniqueness
  // "within a church", and a department name shouldn't collide across
  // Branches of the same church either.
  private async assertNameNotTaken(
    tenant: TenantContext,
    name: string,
    excludeId?: string,
  ) {
    const escaped = name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await this.departmentModel.findOne({
      churchId: tenant.churchId,
      name: { $regex: `^${escaped}$`, $options: 'i' },
      ...(excludeId && { _id: { $ne: excludeId } }),
    });
    if (existing) {
      throw new ConflictException('A department with this name already exists');
    }
  }

  async create(
    authUser: Admin,
    tenant: TenantContext,
    dto: CreateDepartmentDto,
  ) {
    await this.assertNameNotTaken(tenant, dto.name);

    if (dto.hod) {
      await this.assertHodValid(authUser.churchId.toString(), dto.hod);
    }
    if (dto.assistantHod) {
      await this.assertHodValid(authUser.churchId.toString(), dto.assistantHod);
    }

    const memberIds = this.toUniqueIds(dto.memberIds || []);
    await this.assertMembersInChurch(tenant, memberIds);

    const created = await this.departmentModel.create({
      churchId: tenant.churchId,
      branchId: tenant.branchId,
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      hod: dto.hod ? new Types.ObjectId(dto.hod) : null,
      pendingHodEmail: dto.hod
        ? null
        : dto.pendingHodEmail?.toLowerCase().trim() || null,
      assistantHod: dto.assistantHod
        ? new Types.ObjectId(dto.assistantHod)
        : null,
      pendingAssistantHodEmail: dto.assistantHod
        ? null
        : dto.pendingAssistantHodEmail?.toLowerCase().trim() || null,
      members: memberIds.map((id) => new Types.ObjectId(id)),
      status: DepartmentStatus.ACTIVE,
    });

    await this.activityLogService.create(authUser, {
      action: 'Create Department',
      module: ModuleSections.DEPARTMENTS,
      details: `Created department: ${created.name}`,
    });

    return this.findById(tenant, created._id.toString(), authUser);
  }

  async findAll(
    authUser: Admin,
    tenant: TenantContext,
    dto: DepartmentFilterDto,
  ) {
    const { page = 1, limit = 20, search, name, hod, status } = dto;
    const skip = (page - 1) * limit;

    const matchStage: any = buildTenantFilter(tenant);

    if (!this.hasFullDepartmentsAccess(authUser)) {
      matchStage.$and = [
        ...(matchStage.$and || []),
        { $or: [{ hod: authUser._id }, { assistantHod: authUser._id }] },
      ];
    }

    if (search) {
      matchStage.$and = [
        ...(matchStage.$and || []),
        {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ['$hod.firstName', ' ', '$hod.lastName'] },
                  regex: search,
                  options: 'i',
                },
              },
            },
          ],
        },
      ];
    }

    if (name) {
      matchStage.name = { $regex: name, $options: 'i' };
    }
    if (hod) {
      matchStage.hod = new Types.ObjectId(hod);
    }
    if (status) {
      matchStage.status = status;
    }

    const ownershipStage = this.hasFullDepartmentsAccess(authUser)
      ? {}
      : { $or: [{ hod: authUser._id }, { assistantHod: authUser._id }] };

    const [departments, itemCount] = await Promise.all([
      this.departmentModel.aggregate([
        { $match: { ...buildTenantFilter(tenant), ...ownershipStage } },
        {
          $lookup: {
            from: 'admins',
            localField: 'hod',
            foreignField: '_id',
            as: 'hodInfo',
          },
        },
        { $unwind: { path: '$hodInfo', preserveNullAndEmptyArrays: true } },
        {
          $addFields: {
            hod: '$hodInfo',
            hodFullName: {
              $concat: ['$hodInfo.firstName', ' ', '$hodInfo.lastName'],
            },
          },
        },
        {
          $match: search
            ? {
                $or: [
                  { name: { $regex: search, $options: 'i' } },
                  { hodFullName: { $regex: search, $options: 'i' } },
                ],
              }
            : {},
        },
        { $skip: skip },
        { $limit: limit },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: 'members',
            localField: 'members',
            foreignField: '_id',
            as: 'members',
          },
        },
      ]),
      this.departmentModel.countDocuments(matchStage),
    ]);

    return {
      data: departments.map((dept) => this.toDepartmentResponse(dept)),
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async findById(tenant: TenantContext, id: string, authUser: Admin) {
    const department = await this.departmentModel
      .findOne({ _id: id, ...buildTenantFilter(tenant) })
      .populate('hod', 'firstName lastName email')
      .populate('assistantHod', 'firstName lastName email')
      .populate('members', 'fullName email dateJoined   phoneNumber')
      .lean();

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    this.assertCanAccessDepartment(authUser, department);

    return this.toDepartmentResponse(department);
  }

  async update(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: UpdateDepartmentDto,
  ) {
    const existing = await this.departmentModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    this.assertCanAccessDepartment(authUser, existing);

    if (typeof dto.name === 'string' && dto.name.trim() !== existing.name) {
      await this.assertNameNotTaken(tenant, dto.name, id);
    }

    // Reassigning who heads a department is an org-wide administrative
    // Action, not something a department's own head can do to themselves
    // Or anyone else. Compared against the CURRENT value, not just
    // "was the field present" - the edit form always resubmits these.
    const nextHod = dto.hod !== undefined ? dto.hod || null : undefined;
    const currentHod = existing.hod?.toString() || null;
    const hodChanged = nextHod !== undefined && nextHod !== currentHod;

    const nextPendingHod =
      dto.pendingHodEmail !== undefined
        ? dto.pendingHodEmail?.toLowerCase().trim() || null
        : undefined;
    const pendingHodChanged =
      nextPendingHod !== undefined &&
      nextPendingHod !== (existing.pendingHodEmail || null);

    const nextAssistantHod =
      dto.assistantHod !== undefined ? dto.assistantHod || null : undefined;
    const currentAssistantHod = existing.assistantHod?.toString() || null;
    const assistantHodChanged =
      nextAssistantHod !== undefined &&
      nextAssistantHod !== currentAssistantHod;

    const nextPendingAssistantHod =
      dto.pendingAssistantHodEmail !== undefined
        ? dto.pendingAssistantHodEmail?.toLowerCase().trim() || null
        : undefined;
    const pendingAssistantHodChanged =
      nextPendingAssistantHod !== undefined &&
      nextPendingAssistantHod !== (existing.pendingAssistantHodEmail || null);

    if (
      (hodChanged ||
        pendingHodChanged ||
        assistantHodChanged ||
        pendingAssistantHodChanged) &&
      !this.hasFullDepartmentsAccess(authUser)
    ) {
      throw new ForbiddenException(
        'You do not have permission to change this department’s head',
      );
    }

    const updatePayload: Partial<Department> = {};

    if (typeof dto.name === 'string') {
      updatePayload.name = dto.name.trim();
    }
    if (typeof dto.description === 'string') {
      updatePayload.description = dto.description.trim();
    }
    if (dto.hod !== undefined) {
      if (dto.hod) {
        await this.assertHodValid(authUser.churchId.toString(), dto.hod);
        updatePayload.hod = new Types.ObjectId(dto.hod);
      } else {
        updatePayload.hod = null;
      }
      updatePayload.pendingHodEmail = null;
    } else if (dto.pendingHodEmail !== undefined) {
      updatePayload.pendingHodEmail = dto.pendingHodEmail
        ? dto.pendingHodEmail.toLowerCase().trim()
        : null;
      updatePayload.hod = null;
    }
    if (dto.assistantHod !== undefined) {
      if (dto.assistantHod) {
        await this.assertHodValid(
          authUser.churchId.toString(),
          dto.assistantHod,
        );
        updatePayload.assistantHod = new Types.ObjectId(dto.assistantHod);
      } else {
        updatePayload.assistantHod = null;
      }
      updatePayload.pendingAssistantHodEmail = null;
    } else if (dto.pendingAssistantHodEmail !== undefined) {
      updatePayload.pendingAssistantHodEmail = dto.pendingAssistantHodEmail
        ? dto.pendingAssistantHodEmail.toLowerCase().trim()
        : null;
      updatePayload.assistantHod = null;
    }

    await this.departmentModel.updateOne(
      { _id: id, ...buildTenantFilter(tenant) },
      updatePayload,
    );

    await this.activityLogService.create(authUser, {
      action: 'Update Department',
      module: ModuleSections.DEPARTMENTS,
      details: `Updated department: ${existing.name}`,
    });

    return this.findById(tenant, id, authUser);
  }

  async updateStatus(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: UpdateDepartmentStatusDto,
  ) {
    const existing = await this.departmentModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    this.assertCanAccessDepartment(authUser, existing);

    await this.departmentModel.updateOne({ _id: id }, { status: dto.status });

    await this.activityLogService.create(authUser, {
      action: 'Update Department Status',
      module: ModuleSections.DEPARTMENTS,
      details: `Updated department status to ${dto.status} for: ${existing.name}`,
    });

    return this.findById(tenant, id, authUser);
  }

  async updateMembers(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: UpdateDepartmentMembersDto,
  ) {
    const department = await this.departmentModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    this.assertCanAccessDepartment(authUser, department);

    const memberIds = this.toUniqueIds(dto.memberIds);
    await this.assertMembersInChurch(tenant, memberIds);

    let updateQuery = {};
    const memberObjectIds = memberIds.map(
      (memberId) => new Types.ObjectId(memberId),
    );

    if (dto.action === DepartmentMemberAction.ADD) {
      updateQuery = { $addToSet: { members: { $each: memberObjectIds } } };
    } else if (dto.action === DepartmentMemberAction.REMOVE) {
      updateQuery = { $pull: { members: { $in: memberObjectIds } } };
    }

    await this.departmentModel.updateOne({ _id: id }, updateQuery);

    await this.activityLogService.create(authUser, {
      action: 'Update Department Members',
      module: ModuleSections.DEPARTMENTS,
      details: `${dto.action === DepartmentMemberAction.ADD ? 'Added' : 'Removed'} ${memberIds.length} members for ${department.name}`,
    });

    return this.findById(tenant, id, authUser);
  }

  async removeMembers(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    memberIds: string[],
  ) {
    const department = await this.departmentModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    this.assertCanAccessDepartment(authUser, department);

    const uniqueIds = this.toUniqueIds(memberIds);

    const memberObjectIds = uniqueIds.map(
      (memberId) => new Types.ObjectId(memberId),
    );

    await this.departmentModel.updateOne(
      { _id: id },
      { $pull: { members: { $in: memberObjectIds } } },
    );

    await this.activityLogService.create(authUser, {
      action: 'Remove Department Members',
      module: ModuleSections.DEPARTMENTS,
      details: `Removed ${uniqueIds.length} members from ${department.name}`,
    });

    return this.findById(tenant, id, authUser);
  }

  async delete(authUser: Admin, tenant: TenantContext, id: string) {
    // Delete is FULL_ACCESS-only at the route level, so no ownership check
    // Is needed here (matches SmallTeamsService.delete).
    const deleted = await this.departmentModel.findOneAndDelete({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!deleted) {
      throw new NotFoundException('Department not found');
    }

    await this.activityLogService.create(authUser, {
      action: 'Delete Department',
      module: ModuleSections.DEPARTMENTS,
      details: `Deleted department: ${deleted.name}`,
    });

    return { message: 'Department deleted successfully' };
  }

  /**
   * Called once an invited person actually becomes an admin. Any department
   * still waiting on that email as its head or assistant head gets linked
   * automatically. Mirrors SmallTeamsService.resolvePendingLeader.
   */
  async resolvePendingHod(
    churchId: Types.ObjectId,
    email: string,
    adminId: Types.ObjectId,
  ) {
    const normalizedEmail = email.toLowerCase().trim();
    await Promise.all([
      this.departmentModel.updateMany(
        { churchId, pendingHodEmail: normalizedEmail },
        { $set: { hod: adminId, pendingHodEmail: null } },
      ),
      this.departmentModel.updateMany(
        { churchId, pendingAssistantHodEmail: normalizedEmail },
        { $set: { assistantHod: adminId, pendingAssistantHodEmail: null } },
      ),
    ]);
  }

  async export(authUser: Admin, tenant: TenantContext) {
    // Scoped the same way as findAll - otherwise a department head blocked
    // From listing other departments could still pull them all via export.
    const ownershipFilter = this.hasFullDepartmentsAccess(authUser)
      ? {}
      : { $or: [{ hod: authUser._id }, { assistantHod: authUser._id }] };

    const departments = await this.departmentModel
      .find({ ...buildTenantFilter(tenant), ...ownershipFilter })
      .populate('hod', 'firstName lastName email')
      .populate('members', 'fullName email')
      .sort({ name: 1 })
      .lean();

    // Styled workbook themed off the app's design system (primary blue
    // palette from the frontend Tailwind config) rather than a bare CSV.
    const workbook = new Workbook();
    workbook.creator = 'Church Workflow';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Departments', {
      views: [{ state: 'frozen', ySplit: 4 }],
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    const COLUMN_COUNT = 7;

    // Title banner
    sheet.mergeCells(1, 1, 1, COLUMN_COUNT);
    const titleCell = sheet.getCell(1, 1);
    titleCell.value = 'Departments & Units Report';
    titleCell.font = {
      name: 'Calibri',
      size: 16,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0C5FB3' }, // primary-500
    };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(1).height = 30;

    // Sub-caption row
    sheet.mergeCells(2, 1, 2, COLUMN_COUNT);
    const captionCell = sheet.getCell(2, 1);
    captionCell.value =
      `${departments.length} department${departments.length === 1 ? '' : 's'} · Generated ${new Date().toLocaleDateString(
        'en-US',
        { year: 'numeric', month: 'long', day: 'numeric' },
      )}`;
    captionCell.font = {
      name: 'Calibri',
      size: 10,
      italic: true,
      color: { argb: 'FF6B7280' },
    };
    captionCell.alignment = { vertical: 'middle', horizontal: 'center' };
    sheet.getRow(2).height = 18;

    // Spacer row
    sheet.getRow(3).height = 6;

    // Header row
    const header = [
      'Name',
      'Description',
      'Status',
      'HOD Name',
      'HOD Email',
      'Members Count',
      'Created At',
    ];
    const headerRow = sheet.getRow(4);
    headerRow.values = header;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' },
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3D7FC2' }, // primary-400
      };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FF0B56A3' } }, // primary-600
      };
    });
    headerRow.height = 22;

    // Data rows - zebra striping for readability
    departments.forEach((dept: any, index: number) => {
      const row = sheet.getRow(5 + index);
      const hodName = dept.hod
        ? `${dept.hod.firstName || ''} ${dept.hod.lastName || ''}`.trim()
        : 'None';
      const membersCount = Array.isArray(dept.members)
        ? dept.members.length
        : 0;

      row.values = [
        dept.name || '',
        dept.description || '—',
        dept.status || '—',
        hodName || 'None',
        dept.hod?.email || '—',
        membersCount,
        dept.createdAt
          ? new Date(dept.createdAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })
          : '—',
      ];

      const isActive = (dept.status || '').toUpperCase() === 'ACTIVE';

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Calibri', size: 11 };
        cell.alignment = { vertical: 'middle' };

        // Zebra stripe on even data rows
        if (index % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE7EFF7' }, // primary-50
          };
        }
      });

      // Status chip: green tint for active, red tint for inactive
      const statusCell = row.getCell(3);
      statusCell.font = {
        name: 'Calibri',
        size: 11,
        bold: true,
        color: { argb: isActive ? 'FF047857' : 'FFB91C1C' },
      };
      statusCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isActive ? 'FFD1FAE5' : 'FFFEE2E2' },
      };
      statusCell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Column widths tuned to content
    sheet.columns.forEach((column) => {
      let maxWidth = 12;
      column.eachCell?.({ includeEmpty: true }, (cell) => {
        const length = String(cell.value ?? '').length;
        if (length > maxWidth) maxWidth = length;
      });
      column.width = Math.min(Math.max(maxWidth + 4, 12), 42);
    });
    sheet.getColumn(2).width = 42; // Description
    sheet.getColumn(5).width = 28; // HOD Email
    sheet.getColumn(7).width = 14; // Created At

    // Thin bottom border across the table extent
    const lastDataRow = 4 + departments.length;
    for (let col = 1; col <= COLUMN_COUNT; col++) {
      sheet.getCell(lastDataRow, col).border = {
        bottom: { style: 'thin', color: { argb: 'FFB4CDE7' } }, // primary-100
      };
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  private toUniqueIds(ids: string[]) {
    return Array.from(new Set(ids.filter(Boolean)));
  }

  private async assertMembersInChurch(
    tenant: TenantContext,
    memberIds: string[],
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
  }

  private async assertHodValid(churchId: string, adminId: string) {
    const admin = await this.adminService.findById(new Types.ObjectId(adminId));
    if (!admin || admin.churchId.toString() !== churchId) {
      throw new BadRequestException('Invalid HOD selected');
    }
  }

  private toDepartmentResponse(department: any) {
    const members = Array.isArray(department.members) ? department.members : [];
    const memberList = members
      .filter((member: any) => member?._id)
      .map((member: any) => ({
        id: member._id.toString(),
        fullName: member.fullName,
        email: member.email || '',
        dateJoined: member.dateJoined,
        phoneNumber: member.phoneNumber,
      }));

    return {
      id: department._id.toString(),
      name: department.name,
      description: department.description || '',
      status: department.status,
      hod: department.hod
        ? {
            id: department.hod._id?.toString?.() || department.hod.toString(),
            name: `${department.hod.firstName || ''} ${department.hod.lastName || ''}`.trim(),
            email: department.hod.email || '',
          }
        : null,
      pendingHodEmail: department.pendingHodEmail || null,
      assistantHod: department.assistantHod
        ? {
            id:
              department.assistantHod._id?.toString?.() ||
              department.assistantHod.toString(),
            name: `${department.assistantHod.firstName || ''} ${department.assistantHod.lastName || ''}`.trim(),
            email: department.assistantHod.email || '',
          }
        : null,
      pendingAssistantHodEmail: department.pendingAssistantHodEmail || null,
      members: memberList,
      membersCount: members.length,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }
}
