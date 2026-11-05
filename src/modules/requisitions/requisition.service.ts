import { Model, Types } from 'mongoose';

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { paginationMeta } from '../../common/helpers/pagination.helper';
import {
  AccessLevel,
  ModuleSections,
  NotificationType,
  RequisitionStatus,
  RoleType,
} from '../../common/utils/enums.utils';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { buildTenantFilter } from '../../common/utils/tenant-filter.util';
import { Admin } from '../../schemas/admin.schema';
import { Department } from '../../schemas/department.schema';
import { Requisition } from '../../schemas/requisition.schema';
import { Role } from '../../schemas/role.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { ChurchService } from '../church/church.service';
import { ExpenseService } from '../expenses/expense.service';
import { NotificationService } from '../notification/notification.service';
import { CommentRequisitionDto } from './dto/comment-requisition.dto';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { RejectRequisitionDto } from './dto/reject-requisition.dto';
import { RequisitionFilterDto } from './dto/requisition-filter.dto';

@Injectable()
export class RequisitionService {
  constructor(
    @InjectModel(Requisition.name) private requisitionModel: Model<Requisition>,
    @InjectModel(Department.name) private departmentModel: Model<Department>,
    private churchService: ChurchService,
    private expenseService: ExpenseService,
    private notificationService: NotificationService,
    private activityLogService: ActivityLogService,
  ) {}

  private hasFullRequestsAccess(authUser: Admin): boolean {
    const role = authUser.churchRole as unknown as Role;
    if (!role) {
      return false;
    }
    if (role.type === RoleType.SYSTEM && role.roleName === 'Super Admin') {
      return true;
    }
    const perm = role.permissions?.find(
      (p) => p.moduleSection === ModuleSections.REQUESTS,
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

  // Departments this admin heads or assists - used to scope the requisition
  // List for anyone below REQUESTS: FULL_ACCESS, mirroring how
  // DepartmentService scopes findAll for non-full-access department heads.
  private async ledDepartmentIds(
    tenant: TenantContext,
    authUser: Admin,
  ): Promise<Types.ObjectId[]> {
    const departments = await this.departmentModel
      .find({
        ...buildTenantFilter(tenant),
        $or: [{ hod: authUser._id }, { assistantHod: authUser._id }],
      })
      .select('_id')
      .lean();
    return departments.map((d) => d._id as Types.ObjectId);
  }

  async create(
    authUser: Admin,
    tenant: TenantContext,
    dto: CreateRequisitionDto,
  ) {
    const department = await this.departmentModel.findOne({
      _id: dto.departmentId,
      ...buildTenantFilter(tenant),
    });
    if (!department) {
      throw new NotFoundException('Department not found');
    }

    if (
      !this.hasFullRequestsAccess(authUser) &&
      !this.isDepartmentHead(authUser, department)
    ) {
      throw new ForbiddenException(
        'You can only submit requests for a department you head',
      );
    }

    const church = await this.churchService.findById(tenant.churchId);

    const created = await this.requisitionModel.create({
      churchId: tenant.churchId,
      branchId: tenant.branchId,
      departmentId: department._id,
      title: dto.title.trim(),
      description: dto.description?.trim() || '',
      amount: dto.amount,
      currency: church?.defaultCurrency || 'NGN',
      status: RequisitionStatus.PENDING,
      requestedBy: authUser._id,
    });

    await this.activityLogService.create(authUser, {
      action: 'Submit Requisition',
      module: ModuleSections.REQUESTS,
      details: `Submitted requisition "${created.title}" for ${department.name}`,
    });

    await this.notificationService.createNotification(tenant.churchId, {
      title: 'New Requisition Submitted',
      body: `${department.name} submitted a request for "${created.title}" and needs your review.`,
      type: NotificationType.REQUISITION,
    });

    return this.toResponse(created, department);
  }

  async findAll(
    authUser: Admin,
    tenant: TenantContext,
    dto: RequisitionFilterDto,
  ) {
    const { page = 1, limit = 20, departmentId, status } = dto;
    const skip = (page - 1) * limit;

    const filter: any = { ...buildTenantFilter(tenant) };

    if (!this.hasFullRequestsAccess(authUser)) {
      // An explicit departmentId must be checked against, not simply
      // Override, the ownership scope - otherwise a department head could
      // Read another department's requests just by passing its id.
      const ledIds = await this.ledDepartmentIds(tenant, authUser);
      if (departmentId) {
        const isLed = ledIds.some((led) => led.toString() === departmentId);
        if (!isLed) {
          throw new ForbiddenException(
            'You can only view requests for a department you head',
          );
        }
        filter.departmentId = new Types.ObjectId(departmentId);
      } else {
        filter.departmentId = { $in: ledIds };
      }
    } else if (departmentId) {
      filter.departmentId = new Types.ObjectId(departmentId);
    }
    if (status) {
      filter.status = status;
    }

    const [requisitions, itemCount] = await Promise.all([
      this.requisitionModel
        .find(filter)
        .populate('departmentId', 'name')
        .populate('requestedBy', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.requisitionModel.countDocuments(filter),
    ]);

    return {
      data: requisitions.map((r) => this.toResponse(r, r.departmentId)),
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async findById(authUser: Admin, tenant: TenantContext, id: string) {
    const requisition = await this.requisitionModel
      .findOne({ _id: id, ...buildTenantFilter(tenant) })
      .populate('departmentId', 'name hod assistantHod')
      .populate('requestedBy', 'firstName lastName email')
      .lean();

    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    if (
      !this.hasFullRequestsAccess(authUser) &&
      !this.isDepartmentHead(authUser, requisition.departmentId as any)
    ) {
      throw new ForbiddenException(
        'You can only view requests for a department you head',
      );
    }

    return this.toResponse(requisition, requisition.departmentId);
  }

  async addComment(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: CommentRequisitionDto,
  ) {
    const body = dto.body.trim();
    if (!body) {
      throw new BadRequestException('Comment cannot be empty');
    }

    const requisition = await this.requisitionModel
      .findOne({ _id: id, ...buildTenantFilter(tenant) })
      .populate('departmentId', 'name hod assistantHod')
      .populate('requestedBy', 'firstName lastName email');
    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }

    const department = requisition.departmentId as any;
    if (
      !this.hasFullRequestsAccess(authUser) &&
      !this.isDepartmentHead(authUser, department)
    ) {
      throw new ForbiddenException(
        'You can only comment on requests for a department you head',
      );
    }

    const authorName =
      `${authUser.firstName || ''} ${authUser.lastName || ''}`.trim() ||
      authUser.email ||
      'Admin';

    requisition.comments.push({
      authorId: authUser._id as Types.ObjectId,
      authorName,
      body,
    } as any);
    await requisition.save();

    await this.activityLogService.create(authUser, {
      action: 'Comment on Requisition',
      module: ModuleSections.REQUESTS,
      details: `Commented on requisition "${requisition.title}" for ${department.name}`,
    });

    const requester = requisition.requestedBy as any;
    const requesterId = requester?._id?.toString?.() || requester?.toString?.();
    if (requesterId && requesterId !== authUser._id.toString()) {
      await this.notificationService.createNotification(tenant.churchId, {
        title: 'New Comment on Your Request',
        body: `${authorName} commented on "${requisition.title}": ${body}`,
        type: NotificationType.REQUISITION,
        recipientId: requesterId,
      });
    }

    return this.toResponse(requisition, department);
  }

  async approve(authUser: Admin, tenant: TenantContext, id: string) {
    const requisition = await this.requisitionModel
      .findOne({ _id: id, ...buildTenantFilter(tenant) })
      .populate('departmentId', 'name');
    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }
    if (requisition.status !== RequisitionStatus.PENDING) {
      throw new BadRequestException(
        'Only a pending requisition can be approved',
      );
    }

    const department = requisition.departmentId as any;

    const expense = await this.expenseService.create(authUser, tenant, {
      category: 'Requisition',
      description: requisition.title,
      amount: requisition.amount,
      date: new Date().toISOString(),
      departmentId: department._id.toString(),
    });

    requisition.status = RequisitionStatus.APPROVED;
    requisition.reviewedBy = authUser._id;
    requisition.reviewedAt = new Date();
    requisition.expenseId = new Types.ObjectId(expense.id);
    await requisition.save();

    await this.activityLogService.create(authUser, {
      action: 'Approve Requisition',
      module: ModuleSections.REQUESTS,
      details: `Approved requisition "${requisition.title}" for ${department.name}`,
    });

    await this.notificationService.createNotification(tenant.churchId, {
      title: 'Requisition Approved',
      body: `Your request "${requisition.title}" was approved.`,
      type: NotificationType.REQUISITION,
    });

    return this.toResponse(requisition, department);
  }

  async reject(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: RejectRequisitionDto,
  ) {
    const requisition = await this.requisitionModel
      .findOne({ _id: id, ...buildTenantFilter(tenant) })
      .populate('departmentId', 'name');
    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }
    if (requisition.status !== RequisitionStatus.PENDING) {
      throw new BadRequestException(
        'Only a pending requisition can be rejected',
      );
    }

    const department = requisition.departmentId as any;

    requisition.status = RequisitionStatus.REJECTED;
    requisition.reviewedBy = authUser._id;
    requisition.reviewedAt = new Date();
    requisition.reviewNote = dto.reviewNote.trim();
    await requisition.save();

    await this.activityLogService.create(authUser, {
      action: 'Reject Requisition',
      module: ModuleSections.REQUESTS,
      details: `Rejected requisition "${requisition.title}" for ${department.name}: ${dto.reviewNote}`,
    });

    await this.notificationService.createNotification(tenant.churchId, {
      title: 'Requisition Rejected',
      body: `Your request "${requisition.title}" was rejected: ${dto.reviewNote}`,
      type: NotificationType.REQUISITION,
    });

    return this.toResponse(requisition, department);
  }

  async delete(authUser: Admin, tenant: TenantContext, id: string) {
    const requisition = await this.requisitionModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!requisition) {
      throw new NotFoundException('Requisition not found');
    }
    if (requisition.status !== RequisitionStatus.PENDING) {
      throw new BadRequestException(
        'Only a pending requisition can be withdrawn',
      );
    }

    const isSubmitter =
      requisition.requestedBy.toString() === authUser._id.toString();
    if (!isSubmitter && !this.hasFullRequestsAccess(authUser)) {
      throw new ForbiddenException(
        'You can only withdraw a request you submitted',
      );
    }

    await this.requisitionModel.deleteOne({ _id: id });

    await this.activityLogService.create(authUser, {
      action: 'Withdraw Requisition',
      module: ModuleSections.REQUESTS,
      details: `Withdrew requisition "${requisition.title}"`,
    });

    return { message: 'Requisition withdrawn successfully' };
  }

  private toResponse(requisition: any, department: any) {
    const isDeptPopulated =
      department && typeof department === 'object' && department.name;
    const requestedBy = requisition.requestedBy;
    const isRequesterPopulated =
      requestedBy && typeof requestedBy === 'object' && requestedBy.firstName;

    return {
      id: requisition._id.toString(),
      departmentId: isDeptPopulated
        ? department._id.toString()
        : department?.toString(),
      departmentName: isDeptPopulated ? department.name : undefined,
      title: requisition.title,
      description: requisition.description || '',
      amount: requisition.amount || 0,
      currency: requisition.currency,
      status: requisition.status,
      requestedBy: isRequesterPopulated
        ? {
            id: requestedBy._id.toString(),
            name: `${requestedBy.firstName || ''} ${requestedBy.lastName || ''}`.trim(),
            email: requestedBy.email || '',
          }
        : requestedBy?.toString(),
      reviewedBy: requisition.reviewedBy?.toString() || null,
      reviewedAt: requisition.reviewedAt || null,
      reviewNote: requisition.reviewNote || null,
      expenseId: requisition.expenseId?.toString() || null,
      comments: (requisition.comments || []).map((c: any) => ({
        id: c._id?.toString(),
        authorId: c.authorId?.toString(),
        authorName: c.authorName,
        body: c.body,
        createdAt: c.createdAt,
      })),
      createdAt: requisition.createdAt,
      updatedAt: requisition.updatedAt,
    };
  }
}
