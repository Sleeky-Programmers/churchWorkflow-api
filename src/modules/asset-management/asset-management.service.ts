import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { paginationMeta } from '../../common/helpers/pagination.helper';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import {
  AssetCondition,
  AssetMaintenanceTypeFilter,
  ModuleSections,
} from '../../common/utils/enums.utils';
import { buildTenantFilter } from '../../common/utils/tenant-filter.util';
import { Admin } from '../../schemas/admin.schema';
import { Asset } from '../../schemas/asset.schema';
import { AssetHistory } from '../../schemas/asset-history.schema';
import { ActivityLogService } from '../activity-log/activity-log.service';
import { AdminService } from '../admin/admin.service';
import { FileUploadService } from '../file-upload/file-upload.service';
import {
  AssetConditionBreakdownDto,
  AssetUnitDto,
  CreateAssetDto,
} from './dto/create-asset.dto';
import { AssetFilterDto } from './dto/asset-filter.dto';
import { LogServiceDto } from './dto/log-service.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { UpdateMaintenanceNotificationsDto } from './dto/update-maintenance-notifications.dto';

const DUE_WINDOW_DAYS = 7;

@Injectable()
export class AssetManagementService {
  constructor(
    @InjectModel(Asset.name) private assetModel: Model<Asset>,
    @InjectModel(AssetHistory.name)
    private assetHistoryModel: Model<AssetHistory>,
    private adminService: AdminService,
    private activityLogService: ActivityLogService,
    private fileUploadService: FileUploadService,
  ) {}

  async create(authUser: Admin, tenant: TenantContext, dto: CreateAssetDto) {
    if (dto.responsibleMode === 'system' && dto.responsibleAdmin) {
      await this.assertAdminInChurch(
        authUser.churchId.toString(),
        dto.responsibleAdmin,
      );
    }

    const tag = dto.tag?.trim() || this.generateTag();

    const units = dto.units?.length
      ? this.buildUnits(dto.units, [])
      : dto.conditions
        ? this.unitsFromConditions(dto.conditions)
        : [];
    if (!units.length) {
      throw new BadRequestException('Add at least one item to this asset.');
    }
    const conditions = this.conditionsFromUnits(units);

    const created = await this.assetModel.create({
      churchId: tenant.churchId,
      branchId: tenant.branchId,
      name: dto.name.trim(),
      tag,
      category: dto.category,
      department: dto.department ? new Types.ObjectId(dto.department) : null,
      qty: units.length,
      condition: this.deriveCondition(conditions),
      risk: dto.risk,
      status: dto.status,
      description: dto.description.trim(),
      location: dto.location?.trim() || '',
      owner: dto.owner?.trim() || '',
      remarks: dto.remarks?.trim() || '',
      responsibleAdmin:
        dto.responsibleMode === 'system' && dto.responsibleAdmin
          ? new Types.ObjectId(dto.responsibleAdmin)
          : null,
      responsibleManualName:
        dto.responsibleMode === 'manual'
          ? dto.responsibleManualName || null
          : null,
      responsibleManualEmail:
        dto.responsibleMode === 'manual'
          ? dto.responsibleManualEmail || null
          : null,
      conditions,
      units,
      schedule: {
        frequency: dto.maintenanceEnabled ? dto.frequency || null : null,
        lastService: dto.lastService ? new Date(dto.lastService) : null,
        lastReview: dto.lastReview ? new Date(dto.lastReview) : null,
        nextDue: null,
        notificationsEnabled: true,
        notifyUpcoming: true,
        notifyDue: false,
        notifyOverdue: false,
        notifyDaysBefore: 7,
        recipients: [],
      },
      services: [],
      images: [],
    });

    await this.recordHistory(authUser, tenant, created._id, {
      action: 'created this asset',
      tone: 'green',
    });

    await this.activityLogService.create(authUser, {
      action: 'Create Asset',
      module: ModuleSections.ASSETS,
      details: `Created asset: ${created.name}`,
    });

    return this.findById(tenant, created._id.toString());
  }

  async findAll(tenant: TenantContext, dto: AssetFilterDto) {
    const { page = 1, limit = 20, search, category, risk, status, type } = dto;
    const skip = (page - 1) * limit;

    const matchStage: any = buildTenantFilter(tenant);

    if (category) {
      matchStage.category = category;
    }
    if (risk) {
      matchStage.risk = risk;
    }
    if (status) {
      matchStage.status = status;
    }

    if (type === AssetMaintenanceTypeFilter.NIL) {
      matchStage['schedule.frequency'] = null;
    } else if (type === AssetMaintenanceTypeFilter.MAINTENANCE) {
      matchStage['schedule.frequency'] = { $ne: null };
    } else if (type === AssetMaintenanceTypeFilter.DUE) {
      matchStage['schedule.nextDue'] = {
        $ne: null,
        $lte: this.addDays(new Date(), DUE_WINDOW_DAYS),
      };
    }

    if (search) {
      matchStage.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tag: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    const [assets, itemCount] = await Promise.all([
      this.assetModel
        .find(matchStage)
        .populate('department', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.assetModel.countDocuments(matchStage),
    ]);

    return {
      data: assets.map((asset) => this.toAssetListResponse(asset)),
      pagination: paginationMeta({ page, limit, itemCount }),
    };
  }

  async stats(tenant: TenantContext) {
    const base = buildTenantFilter(tenant);
    const now = new Date();
    const dueWindow = this.addDays(now, DUE_WINDOW_DAYS);

    const [totalAssets, maintenanceDue, overdue, highRisk, goodCondition] =
      await Promise.all([
        this.assetModel.countDocuments(base),
        this.assetModel.countDocuments({
          ...base,
          'schedule.nextDue': { $ne: null, $gte: now, $lte: dueWindow },
        }),
        this.assetModel.countDocuments({
          ...base,
          'schedule.nextDue': { $ne: null, $lt: now },
        }),
        this.assetModel.countDocuments({ ...base, risk: 'High' }),
        this.assetModel.countDocuments({
          ...base,
          condition: AssetCondition.GOOD,
        }),
      ]);

    return { totalAssets, maintenanceDue, highRisk, goodCondition, overdue };
  }

  async findById(tenant: TenantContext, id: string) {
    const asset = await this.assetModel
      .findOne({ _id: id, ...buildTenantFilter(tenant) })
      .populate('department', 'name')
      .populate('responsibleAdmin', 'firstName lastName email')
      .populate('services.performedBy', 'firstName lastName email')
      .populate('images.uploadedBy', 'firstName lastName')
      .lean();

    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const history = await this.assetHistoryModel
      .find({ assetId: asset._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return this.toAssetDetailResponse(asset, history);
  }

  async update(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: UpdateAssetDto,
  ) {
    const existing = await this.assetModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!existing) {
      throw new NotFoundException('Asset not found');
    }

    if (dto.responsibleMode === 'system' && dto.responsibleAdmin) {
      await this.assertAdminInChurch(
        authUser.churchId.toString(),
        dto.responsibleAdmin,
      );
    }

    const updatePayload: Record<string, unknown> = {};
    const historyEntries: {
      action: string;
      tone: 'green' | 'amber' | 'purple' | 'blue';
      changes?: Record<string, { from: string; to: string }>;
    }[] = [];

    if (dto.name !== undefined) {
      updatePayload.name = dto.name.trim();
    }
    if (dto.category !== undefined) {
      updatePayload.category = dto.category;
    }
    if (dto.department !== undefined) {
      updatePayload.department = dto.department
        ? new Types.ObjectId(dto.department)
        : null;
    }
    if (dto.description !== undefined) {
      updatePayload.description = dto.description.trim();
    }
    if (dto.location !== undefined) {
      updatePayload.location = dto.location.trim();
    }
    if (dto.owner !== undefined) {
      updatePayload.owner = dto.owner.trim();
    }
    if (dto.remarks !== undefined) {
      updatePayload.remarks = dto.remarks.trim();
    }
    if (dto.risk !== undefined) {
      updatePayload.risk = dto.risk;
    }
    if (dto.status !== undefined) {
      updatePayload.status = dto.status;
    }

    if (dto.responsibleMode === 'system') {
      const nextId = dto.responsibleAdmin || null;
      const currentId = existing.responsibleAdmin?.toString() || null;
      if (nextId !== currentId) {
        historyEntries.push({
          action: 'reassigned the responsible person for this asset',
          tone: 'purple',
        });
      }
      updatePayload.responsibleAdmin = nextId
        ? new Types.ObjectId(nextId)
        : null;
      updatePayload.responsibleManualName = null;
      updatePayload.responsibleManualEmail = null;
    } else if (dto.responsibleMode === 'manual') {
      updatePayload.responsibleAdmin = null;
      updatePayload.responsibleManualName = dto.responsibleManualName || null;
      updatePayload.responsibleManualEmail = dto.responsibleManualEmail || null;
    }

    const previousUnits = this.effectiveUnits(existing);
    const nextUnits = dto.units?.length
      ? this.buildUnits(dto.units, previousUnits)
      : dto.conditions
        ? this.unitsFromConditions(dto.conditions)
        : null;

    if (nextUnits) {
      const conditions = this.conditionsFromUnits(nextUnits);
      const changes = this.describeUnitChanges(previousUnits, nextUnits);
      if (Object.keys(changes).length) {
        historyEntries.push({
          action: 'updated the items and conditions for this asset',
          tone: 'amber',
          changes,
        });
      }
      updatePayload.units = nextUnits;
      updatePayload.conditions = conditions;
      updatePayload.qty = nextUnits.length;
      updatePayload.condition = this.deriveCondition(conditions);
    }

    if (dto.maintenanceEnabled !== undefined || dto.frequency !== undefined) {
      updatePayload['schedule.frequency'] = dto.maintenanceEnabled
        ? dto.frequency || existing.schedule?.frequency || null
        : null;
    }
    if (dto.lastService !== undefined) {
      updatePayload['schedule.lastService'] = dto.lastService
        ? new Date(dto.lastService)
        : null;
    }
    if (dto.lastReview !== undefined) {
      updatePayload['schedule.lastReview'] = dto.lastReview
        ? new Date(dto.lastReview)
        : null;
    }

    await this.assetModel.updateOne({ _id: id }, { $set: updatePayload });

    for (const entry of historyEntries) {
      await this.recordHistory(authUser, tenant, existing._id, entry);
    }

    await this.activityLogService.create(authUser, {
      action: 'Update Asset',
      module: ModuleSections.ASSETS,
      details: `Updated asset: ${existing.name}`,
    });

    return this.findById(tenant, id);
  }

  async delete(authUser: Admin, tenant: TenantContext, id: string) {
    const deleted = await this.assetModel.findOneAndDelete({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!deleted) {
      throw new NotFoundException('Asset not found');
    }

    await this.assetHistoryModel.deleteMany({ assetId: deleted._id });

    await Promise.all(
      (deleted.images || [])
        .filter((image) => image.publicId)
        .map((image) =>
          this.fileUploadService
            .deleteFile(image.publicId as string)
            .catch(() => null),
        ),
    );

    await this.activityLogService.create(authUser, {
      action: 'Delete Asset',
      module: ModuleSections.ASSETS,
      details: `Deleted asset: ${deleted.name}`,
    });

    return { message: 'Asset deleted successfully' };
  }

  async logService(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: LogServiceDto,
  ) {
    const asset = await this.assetModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const recordId = `SR-${String(asset.services.length + 1).padStart(4, '0')}`;
    const nextServiceDate = dto.nextServiceDate
      ? new Date(dto.nextServiceDate)
      : null;

    asset.services.push({
      recordId,
      date: new Date(dto.date),
      performedBy: authUser._id as unknown as Types.ObjectId,
      maintenanceType: dto.maintenanceType,
      notes: dto.notes?.trim() || '',
      nextServiceDate,
      nextReviewDate: nextServiceDate,
      conditionAtService: asset.conditions,
      attachments: [],
      createdAt: new Date(),
    } as any);

    asset.schedule.lastService = new Date(dto.date);
    if (nextServiceDate) {
      asset.schedule.nextDue = nextServiceDate;
    }

    await asset.save();

    await this.recordHistory(authUser, tenant, asset._id, {
      action: 'logged maintenance service',
      tone: 'green',
    });

    await this.activityLogService.create(authUser, {
      action: 'Log Asset Service',
      module: ModuleSections.ASSETS,
      details: `Logged a maintenance service for asset: ${asset.name}`,
    });

    return this.findById(tenant, id);
  }

  async updateNotifications(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    dto: UpdateMaintenanceNotificationsDto,
  ) {
    const existing = await this.assetModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!existing) {
      throw new NotFoundException('Asset not found');
    }

    await this.assetModel.updateOne(
      { _id: id },
      {
        $set: {
          'schedule.notificationsEnabled': dto.notificationsEnabled,
          'schedule.notifyUpcoming': dto.notifyUpcoming,
          'schedule.notifyDue': dto.notifyDue,
          'schedule.notifyOverdue': dto.notifyOverdue,
          'schedule.notifyDaysBefore': dto.notifyDaysBefore,
          'schedule.recipients': dto.recipients,
        },
      },
    );

    return this.findById(tenant, id);
  }

  async uploadImage(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    file: Express.Multer.File,
  ) {
    const asset = await this.assetModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }
    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    const uploaded = await this.fileUploadService.uploadFile(file);

    asset.images.push({
      url: uploaded.url,
      publicId: uploaded.publicId || null,
      name: file.originalname,
      size: file.size,
      uploadedBy: authUser._id as unknown as Types.ObjectId,
      uploadedAt: new Date(),
    } as any);

    await asset.save();

    await this.recordHistory(authUser, tenant, asset._id, {
      action: 'uploaded 1 image',
      tone: 'blue',
    });

    return this.findById(tenant, id);
  }

  async deleteImage(
    authUser: Admin,
    tenant: TenantContext,
    id: string,
    imageId: string,
  ) {
    const asset = await this.assetModel.findOne({
      _id: id,
      ...buildTenantFilter(tenant),
    });
    if (!asset) {
      throw new NotFoundException('Asset not found');
    }

    const image = asset.images.find(
      (img: any) => img._id.toString() === imageId,
    );
    if (!image) {
      throw new NotFoundException('Image not found');
    }

    if (image.publicId) {
      await this.fileUploadService.deleteFile(image.publicId).catch(() => null);
    }

    asset.images = asset.images.filter(
      (img: any) => img._id.toString() !== imageId,
    ) as any;

    await asset.save();

    return this.findById(tenant, id);
  }

  // ---- helpers ----

  private async assertAdminInChurch(churchId: string, adminId: string) {
    const admin = await this.adminService.findById(new Types.ObjectId(adminId));
    if (!admin || admin.churchId.toString() !== churchId) {
      throw new BadRequestException('Invalid responsible person selected');
    }
  }

  /** Units on the asset, or ones derived from the old condition counts. */
  private effectiveUnits(asset: any): any[] {
    if (asset.units?.length) {
      return asset.units;
    }
    return this.unitsFromConditions(
      asset.conditions || { good: 0, fair: 0, repair: 0, damaged: 0 },
      true,
    );
  }

  private unitsFromConditions(
    conditions: AssetConditionBreakdownDto,
    legacy = false,
  ) {
    const order: [AssetCondition, number][] = [
      [AssetCondition.GOOD, conditions.good || 0],
      [AssetCondition.FAIR, conditions.fair || 0],
      [AssetCondition.REPAIR, conditions.repair || 0],
      [AssetCondition.DAMAGED, conditions.damaged || 0],
    ];
    const units: any[] = [];
    for (const [condition, count] of order) {
      for (let i = 0; i < count; i++) {
        units.push({
          unitId: legacy ? `legacy-${units.length}` : this.newUnitId(),
          serial: '',
          condition,
          conditionNote: '',
          purchaseDate: null,
          value: null,
          addedAt: new Date(),
        });
      }
    }
    return units;
  }

  private buildUnits(dtoUnits: AssetUnitDto[], existing: any[]) {
    const known = new Map(existing.map((u) => [u.unitId, u]));
    return dtoUnits.map((unit) => {
      const before = unit.id ? known.get(unit.id) : undefined;
      return {
        unitId: before ? before.unitId : this.newUnitId(),
        serial: (unit.serial || '').trim(),
        condition: unit.condition,
        conditionNote: (unit.conditionNote || '').trim(),
        purchaseDate: unit.purchaseDate ? new Date(unit.purchaseDate) : null,
        value: unit.value ?? null,
        addedAt: before?.addedAt ?? new Date(),
      };
    });
  }

  private conditionsFromUnits(units: { condition: AssetCondition }[]) {
    const counts = { good: 0, fair: 0, repair: 0, damaged: 0 };
    for (const unit of units) {
      if (unit.condition === AssetCondition.GOOD) {
        counts.good += 1;
      } else if (unit.condition === AssetCondition.FAIR) {
        counts.fair += 1;
      } else if (unit.condition === AssetCondition.REPAIR) {
        counts.repair += 1;
      } else if (unit.condition === AssetCondition.DAMAGED) {
        counts.damaged += 1;
      }
    }
    return counts;
  }

  private unitLabel(unit: any, index: number) {
    return unit.serial ? unit.serial : `Item ${index + 1}`;
  }

  private describeUnitChanges(before: any[], after: any[]) {
    const changes: Record<string, { from: string; to: string }> = {};
    const beforeById = new Map(before.map((u) => [u.unitId, u]));
    const afterIds = new Set(after.map((u) => u.unitId));
    let count = 0;

    after.forEach((unit, index) => {
      const prior = beforeById.get(unit.unitId);
      if (!prior) {
        if (count++ < 10) {
          changes[`Added ${this.unitLabel(unit, index)}`] = {
            from: '-',
            to: unit.condition,
          };
        }
      } else if (prior.condition !== unit.condition && count++ < 10) {
        changes[this.unitLabel(unit, index)] = {
          from: prior.condition,
          to: unit.condition,
        };
      }
    });

    before.forEach((unit, index) => {
      if (!afterIds.has(unit.unitId) && count++ < 10) {
        changes[`Removed ${this.unitLabel(unit, index)}`] = {
          from: unit.condition,
          to: '-',
        };
      }
    });

    return changes;
  }

  private newUnitId() {
    return `U-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  }

  private generateTag() {
    return `AST-${Date.now().toString(36).toUpperCase().slice(-8)}`;
  }

  private sumConditions(conditions: AssetConditionBreakdownDto) {
    return (
      (conditions.good || 0) +
      (conditions.fair || 0) +
      (conditions.repair || 0) +
      (conditions.damaged || 0)
    );
  }

  private deriveCondition(
    conditions: AssetConditionBreakdownDto,
  ): AssetCondition {
    if (conditions.damaged) {
      return AssetCondition.DAMAGED;
    }
    if (conditions.repair) {
      return AssetCondition.REPAIR;
    }
    if (conditions.good) {
      return AssetCondition.GOOD;
    }
    return AssetCondition.FAIR;
  }

  private formatConditions(conditions: AssetConditionBreakdownDto) {
    return `Good (${conditions.good}), Fair (${conditions.fair}), Needs Repair (${conditions.repair}), Damaged (${conditions.damaged})`;
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private computeDueState(
    nextDue: Date | null,
  ): 'Upcoming' | 'Due' | 'Overdue' {
    if (!nextDue) {
      return 'Upcoming';
    }
    const now = new Date();
    if (nextDue < now) {
      return 'Overdue';
    }
    if (nextDue <= this.addDays(now, DUE_WINDOW_DAYS)) {
      return 'Due';
    }
    return 'Upcoming';
  }

  private async recordHistory(
    authUser: Admin,
    tenant: TenantContext,
    assetId: Types.ObjectId,
    entry: {
      action: string;
      tone: 'green' | 'amber' | 'purple' | 'blue';
      changes?: Record<string, { from: string; to: string }>;
    },
  ) {
    await this.assetHistoryModel.create({
      assetId,
      churchId: tenant.churchId,
      branchId: tenant.branchId,
      adminId: authUser._id,
      actorName: `${authUser.firstName} ${authUser.lastName}`.trim(),
      action: entry.action,
      changes: entry.changes || {},
      tone: entry.tone,
    });
  }

  private formatDate(date?: Date | string | null) {
    if (!date) {
      return '';
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private formatTime(date?: Date | string | null) {
    if (!date) {
      return '';
    }
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return '';
    }
    return parsed.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  private initialsOf(name: string) {
    return name
      .split(' ')
      .filter(Boolean)
      .map((part) => part.charAt(0))
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private resolveResponsible(asset: any) {
    if (asset.responsibleAdmin?._id) {
      const name =
        `${asset.responsibleAdmin.firstName || ''} ${asset.responsibleAdmin.lastName || ''}`.trim();
      return {
        id: asset.responsibleAdmin._id.toString(),
        name,
        email: asset.responsibleAdmin.email || '',
        initials: this.initialsOf(name || 'NA'),
        isSystem: true,
      };
    }
    if (asset.responsibleManualName) {
      return {
        id: null,
        name: asset.responsibleManualName,
        email: asset.responsibleManualEmail || '',
        initials: this.initialsOf(asset.responsibleManualName),
        isSystem: false,
      };
    }
    return {
      id: null,
      name: 'Unassigned',
      email: '',
      initials: '',
      isSystem: false,
    };
  }

  private toAssetListResponse(asset: any) {
    return {
      id: asset._id.toString(),
      name: asset.name,
      tag: asset.tag,
      avatar: (asset.name || '?').charAt(0).toUpperCase(),
      category: asset.category,
      department: asset.department?.name || '',
      departmentId: asset.department?._id?.toString() || null,
      qty: asset.qty,
      condition: asset.condition,
      needsAttention:
        (asset.conditions?.repair || 0) + (asset.conditions?.damaged || 0),
      risk: asset.risk,
      status: asset.status,
      maintenance: asset.schedule?.frequency || null,
      maintenanceDue: asset.schedule?.nextDue
        ? this.formatDate(asset.schedule.nextDue)
        : null,
    };
  }

  private toAssetDetailResponse(asset: any, history: any[]) {
    const responsible = this.resolveResponsible(asset);

    return {
      id: asset._id.toString(),
      name: asset.name,
      tag: asset.tag,
      avatar: (asset.name || '?').charAt(0).toUpperCase(),
      category: asset.category,
      department: asset.department?.name || '',
      departmentId: asset.department?._id?.toString() || null,
      qty: asset.qty,
      condition: asset.condition,
      risk: asset.risk,
      status: asset.status,
      maintenance: asset.schedule?.frequency || null,
      maintenanceDue: asset.schedule?.nextDue
        ? this.formatDate(asset.schedule.nextDue)
        : null,
      description: asset.description || '',
      location: asset.location || '',
      owner: asset.owner || '',
      dateAdded: this.formatDate(asset.createdAt),
      remarks: asset.remarks || '',
      responsible,
      conditions: asset.conditions,
      units: this.effectiveUnits(asset).map((unit: any) => ({
        id: unit.unitId,
        serial: unit.serial || '',
        condition: unit.condition,
        conditionNote: unit.conditionNote || '',
        purchaseDate: unit.purchaseDate
          ? new Date(unit.purchaseDate).toISOString().slice(0, 10)
          : '',
        value: unit.value ?? null,
        addedAt: this.formatDate(unit.addedAt),
      })),
      schedule: {
        frequency: asset.schedule?.frequency || null,
        lastService: this.formatDate(asset.schedule?.lastService),
        lastReview: this.formatDate(asset.schedule?.lastReview),
        nextDue: this.formatDate(asset.schedule?.nextDue),
        dueState: this.computeDueState(asset.schedule?.nextDue || null),
        notificationsEnabled: asset.schedule?.notificationsEnabled ?? true,
        notifyUpcoming: asset.schedule?.notifyUpcoming ?? true,
        notifyDue: asset.schedule?.notifyDue ?? false,
        notifyOverdue: asset.schedule?.notifyOverdue ?? false,
        notifyDaysBefore: asset.schedule?.notifyDaysBefore ?? 7,
        recipients: asset.schedule?.recipients || [],
      },
      services: (asset.services || [])
        .slice()
        .sort((a: any, b: any) => +new Date(b.date) - +new Date(a.date))
        .map((service: any) => ({
          id: service._id.toString(),
          recordId: service.recordId,
          date: this.formatDate(service.date),
          timeLogged: this.formatTime(service.createdAt),
          performedBy: service.performedBy
            ? `${service.performedBy.firstName || ''} ${service.performedBy.lastName || ''}`.trim()
            : 'Unknown',
          performedByEmail: service.performedBy?.email || '',
          maintenanceType: service.maintenanceType,
          notes: service.notes || '',
          nextServiceDate: service.nextServiceDate
            ? this.formatDate(service.nextServiceDate)
            : 'Not scheduled',
          nextReviewDate: service.nextReviewDate
            ? this.formatDate(service.nextReviewDate)
            : 'Not scheduled',
          conditionAtService: service.conditionAtService,
          attachments: (service.attachments || []).map((a: any) => ({
            id: a._id?.toString?.() || a.name,
            name: a.name,
          })),
        })),
      history: history.map((event: any) => ({
        id: event._id.toString(),
        timestamp: new Date(event.createdAt).toLocaleString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }),
        tone: event.tone,
        actor: event.actorName,
        action: event.action,
      })),
      images: (asset.images || []).map((image: any) => ({
        id: image._id.toString(),
        name: image.name,
        url: image.url,
        size: image.size,
        uploadedBy: image.uploadedBy
          ? `${image.uploadedBy.firstName || ''} ${image.uploadedBy.lastName || ''}`.trim()
          : 'Unknown',
        uploadedDate: this.formatDate(image.uploadedAt),
      })),
    };
  }
}
