import { Model, Types } from 'mongoose';

import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import {
  Recurrence,
  ServiceDay,
  ServiceType,
} from '../../common/utils/enums.utils';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { buildTenantFilter } from '../../common/utils/tenant-filter.util';
import { Admin } from '../../schemas/admin.schema';
import { ChurchService } from '../../schemas/church-service.schema';
import { ServiceInstance } from '../../schemas/service-instance.schema';
import { CreateChurchServiceDto } from './dto/create-church-service.dto';
import { UpdateChurchServiceDto } from './dto/update-church-service.dto';

const DEFAULT_GENERATION_WINDOW = 3;

@Injectable()
export class ChurchServicesService {
  constructor(
    @InjectModel(ChurchService.name)
    private churchServiceModel: Model<ChurchService>,
    @InjectModel(ServiceInstance.name)
    private serviceInstanceModel: Model<any>,
  ) {}

  private readonly logger = new Logger(ChurchServicesService.name);

  private parseTimeToMinutes(time?: string | null): number | null {
    if (!time) {
      return null;
    }
    const match = time
      .trim()
      .toUpperCase()
      .match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/);
    if (!match) {
      return null;
    }
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3];
    if (period === 'AM' && hours === 12) {
      hours = 0;
    } else if (period === 'PM' && hours !== 12) {
      hours += 12;
    }
    return hours * 60 + minutes;
  }

  private timeRangesOverlap(
    startA: number,
    endA: number | null,
    startB: number,
    endB: number | null,
  ): boolean {
    const a2 = endA ?? startA + 1;
    const b2 = endB ?? startB + 1;
    return startA < b2 && startB < a2;
  }

  async create(
    authUser: Admin,
    tenant: TenantContext,
    createChurchServiceDto: CreateChurchServiceDto,
  ) {
    const normalizedName = createChurchServiceDto.title.trim();
    const normalizedLocation = (createChurchServiceDto.location || '').trim();
    const normalizedStartTime = createChurchServiceDto.startTime
      ?.trim()
      .toUpperCase();
    const normalizedEndTime = createChurchServiceDto.endTime
      ?.trim()
      .toUpperCase();

    if (createChurchServiceDto.type === ServiceType.REGULAR) {
      const newStart = this.parseTimeToMinutes(normalizedStartTime);
      const newEnd = this.parseTimeToMinutes(normalizedEndTime);

      const candidates = await this.churchServiceModel
        .find({
          ...buildTenantFilter(tenant),
          type: ServiceType.REGULAR,
          day: createChurchServiceDto.day,
        })
        .lean();

      const overlappingService = candidates.find((service) => {
        const existingStart = this.parseTimeToMinutes(service.startTime);
        const existingEnd = this.parseTimeToMinutes(service.endTime);
        if (existingStart === null || newStart === null) {
          return false;
        }
        return this.timeRangesOverlap(
          newStart,
          newEnd,
          existingStart,
          existingEnd,
        );
      });

      if (overlappingService) {
        const conflictMessage = normalizedEndTime
          ? `A ${overlappingService.type} service already exists on ${overlappingService.day} from ${overlappingService.startTime} to ${overlappingService.endTime || 'ongoing'}. Please choose a non-overlapping schedule.`
          : `A ${overlappingService.type} service already exists on ${overlappingService.day} at ${overlappingService.startTime}. Please choose a different schedule.`;

        throw new BadRequestException(conflictMessage);
      }
    }

    if (createChurchServiceDto.type === ServiceType.SPECIAL) {
      if (createChurchServiceDto.startDate) {
        const startDate = new Date(createChurchServiceDto.startDate);
        const dayStart = new Date(startDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(startDate);
        dayEnd.setHours(23, 59, 59, 999);

        const candidates = await this.churchServiceModel
          .find({
            ...buildTenantFilter(tenant),
            type: ServiceType.SPECIAL,
            startDate: { $gte: dayStart, $lt: dayEnd },
          })
          .lean();

        const newStart = this.parseTimeToMinutes(normalizedStartTime);
        const newEnd = this.parseTimeToMinutes(normalizedEndTime);

        const existing = candidates.find((service) => {
          const existingStart = this.parseTimeToMinutes(service.startTime);
          const existingEnd = this.parseTimeToMinutes(service.endTime);
          if (existingStart === null || newStart === null) {
            return false;
          }
          return this.timeRangesOverlap(
            newStart,
            newEnd,
            existingStart,
            existingEnd,
          );
        });

        if (existing) {
          throw new BadRequestException(
            `A special event already exists on ${createChurchServiceDto.startDate} at ${normalizedStartTime}${normalizedEndTime ? ` to ${normalizedEndTime}` : ''}. Please choose a different date or time.`,
          );
        }
      }

      if (
        createChurchServiceDto.specialDays &&
        createChurchServiceDto.specialDays.length > 0
      ) {
        for (const specialDay of createChurchServiceDto.specialDays) {
          const date = new Date(specialDay.date);
          const dayStartTime = specialDay.startTime?.trim().toUpperCase();
          const dayEndTime = specialDay.endTime?.trim().toUpperCase();

          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);

          const candidates = await this.churchServiceModel
            .find({
              ...buildTenantFilter(tenant),
              type: ServiceType.SPECIAL,
              'specialDays.date': { $gte: dayStart, $lt: dayEnd },
            })
            .lean();

          const newStart = this.parseTimeToMinutes(dayStartTime);
          const newEnd = this.parseTimeToMinutes(dayEndTime);

          const existingSpecialDay = candidates.some((service: any) => {
            return (service.specialDays || []).some((sd: any) => {
              const sdDate = new Date(sd.date);
              sdDate.setHours(0, 0, 0, 0);
              if (sdDate.getTime() !== dayStart.getTime()) {
                return false;
              }
              const existingStart = this.parseTimeToMinutes(sd.startTime);
              const existingEnd = this.parseTimeToMinutes(sd.endTime);
              if (existingStart === null || newStart === null) {
                return false;
              }
              return this.timeRangesOverlap(
                newStart,
                newEnd,
                existingStart,
                existingEnd,
              );
            });
          });

          if (existingSpecialDay) {
            throw new BadRequestException(
              `A special event already exists on ${specialDay.date} at ${dayStartTime}${dayEndTime ? ` to ${dayEndTime}` : ''}. Please choose a different date or time.`,
            );
          }
        }
      }
    }

    const created = await this.churchServiceModel.create({
      ...createChurchServiceDto,
      title: normalizedName,
      startTime: normalizedStartTime,
      endTime: normalizedEndTime,
      location: normalizedLocation || undefined,
      churchId: tenant.churchId,
      branchId: tenant.branchId,
    });

    try {
      if (created.recurrence && created.recurrence !== Recurrence.NO_REPEAT) {
        const sync = process.env.SYNC_GENERATE_INSTANCES === 'true';
        if (sync) {
          await this.generateInstancesForService(
            created._id.toString(),
            DEFAULT_GENERATION_WINDOW,
          );
        } else {
          this.generateInstancesForService(
            created._id.toString(),
            DEFAULT_GENERATION_WINDOW,
          ).catch((err) => {
            return this.logger.error('Generation error', err as any);
          });
        }
      }
    } catch (e) {
      this.logger.error('Error triggering generation', e as any);
    }

    return created;
  }

  async findAll(tenant: TenantContext, paginationBaseDto: PaginationBaseDto) {
    const { page, limit } = paginationBaseDto;

    const skip = (page - 1) * limit;

    const filter = buildTenantFilter(tenant);

    const [services, itemCount] = await Promise.all([
      this.churchServiceModel.find(filter).skip(skip).limit(limit),
      this.churchServiceModel.countDocuments(filter),
    ]);

    return {
      data: services,
      pagination: paginationMeta({
        page,
        limit,
        itemCount,
      }),
    };
  }

  async findById(id: string) {
    return await this.churchServiceModel.findById(id);
  }

  async findByIds(ids: string[]) {
    if (!ids || ids.length === 0) {
      return [];
    }
    const objectIds = ids.map((id) => {
      return new Types.ObjectId(id);
    });
    return await this.churchServiceModel
      .find({ _id: { $in: objectIds } })
      .lean();
  }

  async findOneInChurch(serviceId: string, tenant: TenantContext) {
    return await this.churchServiceModel
      .findOne({
        _id: serviceId,
        ...buildTenantFilter(tenant),
      })
      .lean();
  }

  async findByChurchId(tenant: TenantContext) {
    return await this.churchServiceModel
      .find(buildTenantFilter(tenant))
      .select('_id title type')
      .lean();
  }

  async getServiceIdsByChurchId(tenant: TenantContext) {
    const services = await this.churchServiceModel
      .find(buildTenantFilter(tenant))
      .select('_id')
      .lean();
    return services.map((service) => {
      return service._id;
    });
  }

  async update(id: string, updateChurchServiceDto: UpdateChurchServiceDto) {
    return await this.churchServiceModel.findByIdAndUpdate(
      id,
      updateChurchServiceDto,
      {
        new: true,
      },
    );
  }

  async generateInstancesForService(
    masterServiceId: string,
    monthsWindow = DEFAULT_GENERATION_WINDOW,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(masterServiceId)) {
      return;
    }

    const master = await this.churchServiceModel
      .findById(masterServiceId)
      .lean();
    if (!master) {
      return;
    }

    const today = new Date();
    const startDate = master.startDate ? new Date(master.startDate) : today;
    const generationStart = new Date(
      Math.max(startDate.getTime(), today.getTime()),
    );
    generationStart.setHours(0, 0, 0, 0);

    const generationEnd = new Date(generationStart);
    generationEnd.setMonth(generationEnd.getMonth() + monthsWindow);
    generationEnd.setHours(23, 59, 59, 999);

    this.logger.log(
      `Generating instances for master ${masterServiceId} from ${generationStart.toISOString()} to ${generationEnd.toISOString()}`,
    );

    const operations: Array<Promise<any>> = [];

    for (
      let date = new Date(generationStart);
      date <= generationEnd;
      date.setDate(date.getDate() + 1)
    ) {
      const current = new Date(date);
      if (!this.isServiceOnDate(master, current)) {
        continue;
      }

      const instanceDoc = {
        masterServiceId: master._id,
        churchId: master.churchId,
        branchId: master.branchId,
        date: new Date(current),
        title: master.title,
        startTime: master.startTime,
        endTime: master.endTime,
        location: master.location,
        type: master.type,
        createdFromRecurring: true,
        reminderEnabled: master.reminderEnabled || false,
        reminderType: master.reminderType || null,
        reminderTimeBefore: master.reminderTimeBefore || null,
        reminderSent: false,
      };

      operations.push(
        this.serviceInstanceModel.findOneAndUpdate(
          { masterServiceId: master._id, date: instanceDoc.date },
          { $set: instanceDoc },
          { upsert: true, new: true },
        ),
      );
    }

    try {
      const res = await Promise.all(operations);
      this.logger.log(
        `Upserted ${res.length} instances for master ${masterServiceId}`,
      );
    } catch (err) {
      this.logger.error('Error generating instances', err as any);
      throw err;
    }
  }

  async regenerateInstancesForService(
    masterServiceId: string,
    monthsWindow = DEFAULT_GENERATION_WINDOW,
  ) {
    if (!Types.ObjectId.isValid(masterServiceId)) {
      return;
    }
    const master = await this.churchServiceModel
      .findById(masterServiceId)
      .lean();
    if (!master) {
      return;
    }

    const generationStart = new Date();
    generationStart.setHours(0, 0, 0, 0);
    const generationEnd = new Date(generationStart);
    generationEnd.setMonth(generationEnd.getMonth() + monthsWindow);
    generationEnd.setHours(23, 59, 59, 999);

    await this.serviceInstanceModel.deleteMany({
      masterServiceId: new Types.ObjectId(masterServiceId),
      date: { $gte: generationStart, $lte: generationEnd },
    });

    await this.generateInstancesForService(masterServiceId, monthsWindow);
  }

  async generateInstancesForChurch(
    churchId: Types.ObjectId,
    monthsWindow = DEFAULT_GENERATION_WINDOW,
  ) {
    const masters = await this.churchServiceModel
      .find({ churchId, recurrence: { $ne: Recurrence.NO_REPEAT } })
      .lean();

    for (const master of masters) {
      await this.generateInstancesForService(
        master._id.toString(),
        monthsWindow,
      );
    }
  }

  async regenerateInstancesForChurch(
    churchId: Types.ObjectId,
    monthsWindow = DEFAULT_GENERATION_WINDOW,
  ) {
    const masters = await this.churchServiceModel
      .find({ churchId, recurrence: { $ne: Recurrence.NO_REPEAT } })
      .lean();

    for (const master of masters) {
      await this.regenerateInstancesForService(
        master._id.toString(),
        monthsWindow,
      );
    }
  }

  async findAllMastersForRegen() {
    return await this.churchServiceModel
      .find({ recurrence: { $ne: Recurrence.NO_REPEAT } })
      .select('_id churchId')
      .lean();
  }

  async delete(id: string) {
    return await this.churchServiceModel.findByIdAndDelete(id);
  }

  async getServiceIdsByType(type: string) {
    const services = await this.churchServiceModel
      .find({ type })
      .select('_id')
      .lean();
    return services.map((s) => {
      return s._id;
    });
  }

  async getServicesByDate(date: Date, tenant: TenantContext) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const services = await this.churchServiceModel
      .find(buildTenantFilter(tenant))
      .lean();

    const result = services.filter((service: any) => {
      return this.isServiceOnDate(service, date);
    });

    return result;
  }

  async getServicesFiltered(
    tenant: TenantContext,
    year?: number,
    month?: number,
    day?: number,
  ) {
    const now = new Date();
    const y = year || now.getFullYear();

    let start: Date;
    let end: Date;

    if (month) {
      start = new Date(y, month - 1, day || 1);
      if (day) {
        end = new Date(y, month - 1, day);
      } else {
        end = new Date(y, month, 0);
      }
    } else {
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const instances = await this.serviceInstanceModel
      .find({ ...buildTenantFilter(tenant), date: { $gte: start, $lte: end } })
      .lean();

    const instanceMap = new Set<string>();
    const results: any[] = [];

    for (const inst of instances) {
      const dayKey = new Date(inst.date).toISOString().split('T')[0];
      instanceMap.add(`${inst.masterServiceId?.toString() || ''}|${dayKey}`);
      results.push({
        id: inst._id,
        masterServiceId: inst.masterServiceId,
        date: inst.date,
        title: inst.title,
        startTime: inst.startTime,
        endTime: inst.endTime,
        location: inst.location,
        type: inst.type,
        generated: true,
      });
    }

    const masters = await this.churchServiceModel
      .find(buildTenantFilter(tenant))
      .lean();

    for (const master of masters) {
      for (
        let date = new Date(start);
        date <= end;
        date.setDate(date.getDate() + 1)
      ) {
        const current = new Date(date);
        if (!this.isServiceOnDate(master, current)) {
          continue;
        }

        const dayKey = current.toISOString().split('T')[0];
        const mapKey = `${master._id.toString()}|${dayKey}`;
        if (instanceMap.has(mapKey)) {
          continue;
        }

        results.push({
          masterServiceId: master._id,
          date: new Date(current),
          title: master.title,
          startTime: master.startTime,
          endTime: master.endTime,
          location: master.location,
          type: master.type,
          generated: false,
        });
      }
    }

    results.sort((a, b) => {
      const dateA = new Date(a.date).toISOString();
      const dateB = new Date(b.date).toISOString();
      if (dateA === dateB) {
        return (a.title || '').localeCompare(b.title || '');
      }
      return dateA.localeCompare(dateB);
    });

    return results;
  }

  private static readonly WEEKDAY_BY_INDEX = {
    0: ServiceDay.SUNDAY,
    1: ServiceDay.MONDAY,
    2: ServiceDay.TUESDAY,
    3: ServiceDay.WEDNESDAY,
    4: ServiceDay.THURSDAY,
    5: ServiceDay.FRIDAY,
    6: ServiceDay.SATURDAY,
  } as const;

  // WEEKLY_MONDAY/MONTHLY_FIRST_MONDAY are historical recurrence names that
  // Actually mean "weekly/monthly on whatever day this service runs" -
  // Every weekly service is saved with recurrence WEEKLY_MONDAY regardless
  // Of its actual day (see frontend attendance page), so the match has to
  // Be against service.day, not literally Monday. Falls back to Monday
  // Only for legacy services saved without a day.
  private matchesServiceWeekday(service: any, dayIndex: number): boolean {
    const expectedDay = service.day || ServiceDay.MONDAY;
    return expectedDay === ChurchServicesService.WEEKDAY_BY_INDEX[dayIndex];
  }

  private isServiceOnDate(service: any, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const withinStartEnd = (service: any) => {
      if (service.startDate && new Date(service.startDate) > endOfDay) {
        return false;
      }
      if (service.endDate && new Date(service.endDate) < startOfDay) {
        return false;
      }
      return true;
    };

    if (!withinStartEnd(service)) {
      return false;
    }

    const dayIndex = date.getDay();

    if (service.specialDays?.length) {
      for (const specialDay of service.specialDays) {
        const specialDayDate = new Date(specialDay.date);
        specialDayDate.setHours(0, 0, 0, 0);
        if (specialDayDate.getTime() === startOfDay.getTime()) {
          return true;
        }
      }
    }

    const recurrence: Recurrence = service.recurrence || Recurrence.NO_REPEAT;

    switch (recurrence) {
      case Recurrence.NO_REPEAT: {
        if (service.type === ServiceType.SPECIAL) {
          if (service.startDate) {
            const serviceDate = new Date(service.startDate);
            serviceDate.setHours(0, 0, 0, 0);
            return serviceDate.getTime() === startOfDay.getTime();
          }
          return false;
        }

        if (service.day) {
          return this.matchesServiceWeekday(service, dayIndex);
        }

        return false;
      }
      case Recurrence.DAILY: {
        return true;
      }
      case Recurrence.WEEKDAYS: {
        return dayIndex >= 1 && dayIndex <= 5;
      }
      case Recurrence.WEEKLY_MONDAY: {
        return this.matchesServiceWeekday(service, dayIndex);
      }
      case Recurrence.MONTHLY_FIRST_MONDAY: {
        if (!this.matchesServiceWeekday(service, dayIndex)) {
          return false;
        }
        const dayOfMonth = date.getDate();
        return dayOfMonth <= 7;
      }
      case Recurrence.ANNUALLY: {
        if (!service.startDate) {
          return false;
        }
        const serviceDate = new Date(service.startDate);
        return (
          serviceDate.getDate() === date.getDate() &&
          serviceDate.getMonth() === date.getMonth()
        );
      }
      default:
        return false;
    }
  }

  /**
   * Timezone-safe version of isServiceOnDate for the attendance write path.
   * Takes a 'YYYY-MM-DD' calendar date (as already produced by
   * AttendanceService.normalizeDate) and compares it purely as calendar
   * dates/UTC components - never through a Date's local getters - so a
   * server running in a different timezone than the church can't shift a
   * late-night service onto the wrong day.
   */
  isServiceScheduledOn(service: any, dateKey: string): boolean {
    const [year, month, day] = dateKey.split('-').map(Number);
    if (!year || !month || !day) {
      return false;
    }
    const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

    const toDateKey = (value: any): string | null => {
      if (!value) {
        return null;
      }
      const d = new Date(value);
      if (isNaN(d.getTime())) {
        return null;
      }
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    };

    const startKey = toDateKey(service.startDate);
    if (startKey && startKey > dateKey) {
      return false;
    }
    const endKey = toDateKey(service.endDate);
    if (endKey && endKey < dateKey) {
      return false;
    }

    if (service.specialDays?.length) {
      for (const specialDay of service.specialDays) {
        if (toDateKey(specialDay.date) === dateKey) {
          return true;
        }
      }
    }

    const recurrence: Recurrence = service.recurrence || Recurrence.NO_REPEAT;

    switch (recurrence) {
      case Recurrence.NO_REPEAT: {
        if (service.type === ServiceType.SPECIAL) {
          return startKey === dateKey;
        }

        if (service.day) {
          return this.matchesServiceWeekday(service, dayIndex);
        }

        return false;
      }
      case Recurrence.DAILY: {
        return true;
      }
      case Recurrence.WEEKDAYS: {
        return dayIndex >= 1 && dayIndex <= 5;
      }
      case Recurrence.WEEKLY_MONDAY: {
        return this.matchesServiceWeekday(service, dayIndex);
      }
      case Recurrence.MONTHLY_FIRST_MONDAY: {
        return this.matchesServiceWeekday(service, dayIndex) && day <= 7;
      }
      case Recurrence.ANNUALLY: {
        if (!service.startDate) {
          return false;
        }
        const sd = new Date(service.startDate);
        return sd.getUTCDate() === day && sd.getUTCMonth() === month - 1;
      }
      default:
        return false;
    }
  }
}
