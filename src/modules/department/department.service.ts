import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { Department } from '../../schemas/department.schema';
import { Admin } from '../../schemas/admin.schema';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { DepartmentFilterDto } from './dto/department-filter.dto';
import { UpdateDepartmentMembersDto } from './dto/update-department-members.dto';
import { UpdateDepartmentStatusDto } from './dto/update-department-status.dto';
import { MembersService } from '../members/members.service';
import { AdminService } from '../admin/admin.service';
import { ActivityLogService } from '../activity-log/activity-log.service';
import {
  ModuleSections,
  DepartmentStatus,
  DepartmentMemberAction,
} from '../../common/utils/enums.utils';
import { paginationMeta } from '../../common/helpers/pagination.helper';

@Injectable()
export class DepartmentService {
  constructor(
    @InjectModel(Department.name) private departmentModel: Model<Department>,
    private membersService: MembersService,
    private adminService: AdminService,
    private activityLogService: ActivityLogService,
  ) {}

  async create(authUser: Admin, dto: CreateDepartmentDto) {
    if (dto.hod) {
      await this.assertHodValid(authUser.churchId.toString(), dto.hod);
    }

    const memberIds = this.toUniqueIds(dto.memberIds || []);
    await this.assertMembersInChurch(authUser, memberIds);

    const created = await this.departmentModel.create({
      churchId: authUser.churchId,
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      hod: dto.hod ? new Types.ObjectId(dto.hod) : null,
      members: memberIds.map((id) => new Types.ObjectId(id)),
      status: DepartmentStatus.ACTIVE,
    });

    await this.activityLogService.create(authUser, {
      action: 'Create Department',
      module: ModuleSections.DEPARTMENTS,
      details: `Created department: ${created.name}`,
    });

    return this.findById(authUser, created._id.toString());
  }

  async findAll(authUser: Admin, dto: DepartmentFilterDto) {
    const { page = 1, limit = 20, search, name, hod, status } = dto;
    const skip = (page - 1) * limit;

    const query: FilterQuery<Department> = { churchId: authUser.churchId };

    if (search) {
      query.$or = [{ name: { $regex: search, $options: 'i' } }];
    }
    if (name) {
      query.name = { $regex: name, $options: 'i' };
    }
    if (hod) {
      query.hod = new Types.ObjectId(hod);
    }
    if (status) {
      query.status = status;
    }

    const [departments, itemCount] = await Promise.all([
      this.departmentModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('hod', 'firstName lastName email')
        .populate('members', 'fullName email')
        .lean(),
      this.departmentModel.countDocuments(query),
    ]);

    return {
      data: departments.map((dept) => this.toDepartmentResponse(dept)),
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async findById(authUser: Admin, id: string) {
    const department = await this.departmentModel
      .findOne({ _id: id, churchId: authUser.churchId })
      .populate('hod', 'firstName lastName email')
      .populate('members', 'fullName email dateJoined   phoneNumber')
      .lean();

    if (!department) {
      throw new NotFoundException('Department not found');
    }

    return this.toDepartmentResponse(department);
  }

  async update(authUser: Admin, id: string, dto: UpdateDepartmentDto) {
    const existing = await this.departmentModel.findOne({
      _id: id,
      churchId: authUser.churchId,
    });
    if (!existing) {
      throw new NotFoundException('Department not found');
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
    }

    await this.departmentModel.updateOne(
      { _id: id, churchId: authUser.churchId },
      updatePayload,
    );

    await this.activityLogService.create(authUser, {
      action: 'Update Department',
      module: ModuleSections.DEPARTMENTS,
      details: `Updated department: ${existing.name}`,
    });

    return this.findById(authUser, id);
  }

  async updateStatus(
    authUser: Admin,
    id: string,
    dto: UpdateDepartmentStatusDto,
  ) {
    const existing = await this.departmentModel.findOne({
      _id: id,
      churchId: authUser.churchId,
    });
    if (!existing) {
      throw new NotFoundException('Department not found');
    }

    await this.departmentModel.updateOne({ _id: id }, { status: dto.status });

    await this.activityLogService.create(authUser, {
      action: 'Update Department Status',
      module: ModuleSections.DEPARTMENTS,
      details: `Updated department status to ${dto.status} for: ${existing.name}`,
    });

    return this.findById(authUser, id);
  }

  async updateMembers(
    authUser: Admin,
    id: string,
    dto: UpdateDepartmentMembersDto,
  ) {
    const department = await this.departmentModel.findOne({
      _id: id,
      churchId: authUser.churchId,
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    const memberIds = this.toUniqueIds(dto.memberIds);
    await this.assertMembersInChurch(authUser, memberIds);

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

    return this.findById(authUser, id);
  }


  async removeMembers(
  authUser: Admin,
  id: string,
  memberIds: string[],
) {
  const department = await this.departmentModel.findOne({
    _id: id,
    churchId: authUser.churchId,
  });

  if (!department) {
    throw new NotFoundException('Department not found');
  }

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

  return this.findById(authUser, id);
}

  async delete(authUser: Admin, id: string) {
    const deleted = await this.departmentModel.findOneAndDelete({
      _id: id,
      churchId: authUser.churchId,
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

  async export(authUser: Admin) {
    const departments = await this.departmentModel
      .find({ churchId: authUser.churchId })
      .populate('hod', 'firstName lastName email')
      .populate('members', 'fullName email')
      .lean();

    const header = [
      'Name',
      'Description',
      'Status',
      'HOD Name',
      'HOD Email',
      'Members Count',
      'Created At',
    ];

    const rows = departments.map((dept: any) => {
      const escapedName = (dept.name || '').replace(/"/g, '""');
      const escapedDesc = (dept.description || '').replace(/"/g, '""');
      const hodName = dept.hod
        ? `${dept.hod.firstName} ${dept.hod.lastName}`
            .trim()
            .replace(/"/g, '""')
        : 'None';
      const hodEmail = dept.hod?.email
        ? dept.hod.email.replace(/"/g, '""')
        : '';
      const membersCount = Array.isArray(dept.members)
        ? dept.members.length
        : 0;
      const createdAt = new Date(dept.createdAt).toISOString();

      return [
        `"${escapedName}"`,
        `"${escapedDesc}"`,
        `"${dept.status}"`,
        `"${hodName}"`,
        `"${hodEmail}"`,
        membersCount,
        `"${createdAt}"`,
      ];
    });

    return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
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
        phoneNumber:member.phoneNumber
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
      members: memberList,
      membersCount: members.length,
      createdAt: department.createdAt,
      updatedAt: department.updatedAt,
    };
  }
}
