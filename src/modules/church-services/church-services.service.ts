import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChurchService } from '../../schemas/church-service.schema';
import { Admin } from '../../schemas/admin.schema';
import { CreateChurchServiceDto } from './dto/create-church-service.dto';
import {
  PaginationBaseDto,
  paginationMeta,
} from '../../common/helpers/pagination.helper';
import { UpdateChurchServiceDto } from './dto/update-church-service.dto';
import {
  ServiceDay,
  ServiceType,
  Recurrence,
} from '../../common/utils/enums.utils';

import { Logger } from '@nestjs/common';

const DEFAULT_GENERATION_WINDOW = 3;

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

@Injectable()
export class ChurchServicesService {
  constructor(
    @InjectModel(ChurchService.name)
    private churchServiceModel: Model<ChurchService>,
    @InjectModel('ServiceInstance')
    private serviceInstanceModel: Model<any>,
  ) {}

  private readonly logger = new Logger(ChurchServicesService.name);

  async create(
    authUser: Admin,
    createChurchServiceDto: CreateChurchServiceDto,
  ) {
    const normalizedName = createChurchServiceDto.title.trim();
    const normalizedLocation = (createChurchServiceDto.location || '').trim();
    const normalizedStartTime = createChurchServiceDto.startTime
      ?.trim()
      .toUpperCase();

    if (normalizedStartTime) {
      const duplicateFilter: any = {
        churchId: authUser.churchId,
        title: {
          $regex: `^${escapeRegExp(normalizedName)}$`,
          $options: 'i',
        },
        startTime: normalizedStartTime,
      };
      duplicateFilter.location = normalizedLocation
        ? {
            $regex: `^${escapeRegExp(normalizedLocation)}$`,
            $options: 'i',
          }
        : { $in: [null, ''] };

      if (createChurchServiceDto.type) {
        duplicateFilter.type = createChurchServiceDto.type;
      }

      if (createChurchServiceDto.day) {
        duplicateFilter.day = createChurchServiceDto.day;
      }

      if (createChurchServiceDto.startDate) {
        duplicateFilter.startDate = new Date(createChurchServiceDto.startDate);
      }

      const existing = await this.churchServiceModel.findOne(duplicateFilter);
      if (existing) {
        throw new BadRequestException(
          'Event with same name and time already exists',
        );
      }
    }

    const created = await this.churchServiceModel.create({
      ...createChurchServiceDto,
      title: normalizedName,
      startTime: normalizedStartTime,
      location: normalizedLocation || undefined,
      churchId: authUser.churchId,
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
          ).catch((err) => this.logger.error('Generation error', err as any));
        }
      }
    } catch (e) {
      this.logger.error('Error triggering generation', e as any);
    }

    return created;
  }

  async findAll(authUser: Admin, paginationBaseDto: PaginationBaseDto) {
    const { page, limit } = paginationBaseDto;

    const skip = (page - 1) * limit;

    const filter = { churchId: authUser.churchId };

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

  async findOneInChurch(serviceId: string, churchId: Types.ObjectId) {
    return await this.churchServiceModel
      .findOne({
        _id: serviceId,
        churchId,
      })
      .lean();
  }

  async findByChurchId(churchId: Types.ObjectId) {
    return await this.churchServiceModel
      .find({ churchId })
      .select('_id title type')
      .lean();
  }

  async getServiceIdsByChurchId(churchId: Types.ObjectId) {
    const services = await this.churchServiceModel
      .find({ churchId })
      .select('_id')
      .lean();
    return services.map((service) => service._id);
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

    const ops: Array<Promise<any>> = [];

    for (
      let d = new Date(generationStart);
      d <= generationEnd;
      d.setDate(d.getDate() + 1)
    ) {
      const current = new Date(d);
      if (!this.isServiceOnDate(master, current)) {
        continue;
      }

      const instanceDoc = {
        masterServiceId: master._id,
        churchId: master.churchId,
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

      ops.push(
        this.serviceInstanceModel.findOneAndUpdate(
          { masterServiceId: master._id, date: instanceDoc.date },
          { $set: instanceDoc },
          { upsert: true, new: true },
        ),
      );
    }

    try {
      const res = await Promise.all(ops);
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

    for (const m of masters) {
      await this.generateInstancesForService(m._id.toString(), monthsWindow);
    }
  }

  async regenerateInstancesForChurch(
    churchId: Types.ObjectId,
    monthsWindow = DEFAULT_GENERATION_WINDOW,
  ) {
    const masters = await this.churchServiceModel
      .find({ churchId, recurrence: { $ne: Recurrence.NO_REPEAT } })
      .lean();

    for (const m of masters) {
      await this.regenerateInstancesForService(m._id.toString(), monthsWindow);
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
    return services.map((s) => s._id);
  }

  async getServicesByDate(date: Date, churchId: Types.ObjectId) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const services = await this.churchServiceModel.find({ churchId }).lean();

    const result = services.filter((svc: any) =>
      this.isServiceOnDate(svc, date),
    );

    return result;
  }

  /**
   * Get services (instances + generated occurrences) filtered by year/month/day.
   * If `month` is provided, `year` defaults to current year. If only `year` is provided, returns whole year.
   */
  async getServicesFiltered(
    churchId: Types.ObjectId,
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
      .find({ churchId, date: { $gte: start, $lte: end } })
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

    const masters = await this.churchServiceModel.find({ churchId }).lean();

    for (const master of masters) {
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const current = new Date(d);
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
      const da = new Date(a.date).toISOString();
      const db = new Date(b.date).toISOString();
      if (da === db) {
        return (a.title || '').localeCompare(b.title || '');
      }
      return da.localeCompare(db);
    });

    return results;
  }

  private isServiceOnDate(service: any, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const withinStartEnd = (svc: any) => {
      if (svc.startDate && new Date(svc.startDate) > endOfDay) {
        return false;
      }
      if (svc.endDate && new Date(svc.endDate) < startOfDay) {
        return false;
      }
      return true;
    };

    if (!withinStartEnd(service)) {
      return false;
    }

    const dayIndex = date.getDay();

    if (service.specialDays?.length) {
      for (const sd of service.specialDays) {
        const sdDate = new Date(sd.date);
        sdDate.setHours(0, 0, 0, 0);
        if (sdDate.getTime() === startOfDay.getTime()) {
          return true;
        }
      }
    }

    const recurrence: Recurrence = service.recurrence || Recurrence.NO_REPEAT;

    switch (recurrence) {
      case Recurrence.NO_REPEAT: {
        if (service.type === ServiceType.SPECIAL) {
          if (service.startDate) {
            const s = new Date(service.startDate);
            s.setHours(0, 0, 0, 0);
            return s.getTime() === startOfDay.getTime();
          }
          return false;
        }

        if (service.day) {
          const weekdayMap = {
            0: ServiceDay.SUNDAY,
            1: ServiceDay.MONDAY,
            2: ServiceDay.TUESDAY,
            3: ServiceDay.WEDNESDAY,
            4: ServiceDay.THURSDAY,
            5: ServiceDay.FRIDAY,
            6: ServiceDay.SATURDAY,
          } as const;
          return service.day === weekdayMap[dayIndex];
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
        return dayIndex === 1;
      }
      case Recurrence.MONTHLY_FIRST_MONDAY: {
        if (dayIndex !== 1) {
          return false;
        }
        const dayOfMonth = date.getDate();
        return dayOfMonth <= 7;
      }
      case Recurrence.ANNUALLY: {
        if (!service.startDate) {
          return false;
        }
        const s = new Date(service.startDate);
        return (
          s.getDate() === date.getDate() && s.getMonth() === date.getMonth()
        );
      }
      default:
        return false;
    }
  }
}
