import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChurchServicesService } from './church-services.service';
import { Types } from 'mongoose';

@Injectable()
export class ChurchServicesScheduler {
  private readonly logger = new Logger(ChurchServicesScheduler.name);

  constructor(private readonly churchServicesService: ChurchServicesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyRegen() {
    this.logger.log('Starting daily regeneration of service instances');

    try {
      const services =
        await this.churchServicesService.findAllMastersForRegen();

      const churchIdSet = new Set<string>();
      for (const service of services) {
        if (service.churchId) {
          churchIdSet.add(service.churchId.toString());
        }
      }

      for (const id of Array.from(churchIdSet)) {
        this.logger.log(`Regenerating instances for church ${id}`);
        await this.churchServicesService.regenerateInstancesForChurch(
          new Types.ObjectId(id),
          3,
        );
      }

      this.logger.log('Completed daily regeneration of service instances');
    } catch (err) {
      this.logger.error('Error during daily regeneration', err as any);
    }
  }
}
