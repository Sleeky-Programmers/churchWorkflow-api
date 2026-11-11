import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { ServiceInstance } from '../../schemas/service-instance.schema';
import { EmailService } from '../email/email.service';
import { renderEmailLayout } from '../email/templates/email-layout.template';
import { AdminService } from '../admin/admin.service';
import { ReminderType } from '../../common/utils/enums.utils';

@Injectable()
export class ChurchServicesReminderScheduler {
  private readonly logger = new Logger(ChurchServicesReminderScheduler.name);

  constructor(
    @InjectModel(ServiceInstance.name) private serviceInstanceModel: Model<any>,
    private readonly emailService: EmailService,
    private readonly adminService: AdminService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleEmailReminders() {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 60 * 1000);
    const windowEnd = new Date(now.getTime() + 60 * 1000);

    try {
      const candidates = await this.serviceInstanceModel
        .find({
          reminderEnabled: true,
          reminderType: ReminderType.EMAIL,
          reminderSent: false,
          // Reminders fire at most hours before the service, so only
          // Instances within a day either side of now can be due. Without
          // This, every future unsent instance was loaded each minute.
          date: {
            $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            $lte: new Date(now.getTime() + 48 * 60 * 60 * 1000),
          },
        })
        .lean();

      // Admin emails per church, fetched once per run rather than per instance.
      const emailsByChurch = new Map<string, string[]>();

      for (const instance of candidates) {
        const sendTime = this.computeSendTime(
          instance.date,
          instance.startTime,
          instance.reminderTimeBefore,
        );
        if (!sendTime) {
          continue;
        }

        if (sendTime >= windowStart && sendTime <= windowEnd) {
          const churchKey = String(instance.churchId);
          let emails = emailsByChurch.get(churchKey);
          if (!emails) {
            const admins = await this.adminService.findAll(
              new Types.ObjectId(instance.churchId),
            );
            emails = admins
              .map((a) => {
                return a.email;
              })
              .filter(Boolean);
            emailsByChurch.set(churchKey, emails);
          }
          if (emails.length === 0) {
            continue;
          }

          const subject = `Reminder: ${instance.title} - ${new Date(instance.date).toDateString()}`;
          const html = renderEmailLayout({
            previewText: subject,
            heading: 'Upcoming Service Reminder',
            paragraphs: [
              `This is a reminder for <strong>${instance.title}</strong> scheduled on ${new Date(instance.date).toLocaleString()}.`,
            ],
          });

          for (const to of emails) {
            try {
              await this.emailService.sendEmail(to, subject, html);
            } catch (err) {
              this.logger.error(`Failed to send reminder to ${to}`, err as any);
            }
          }

          await this.serviceInstanceModel.updateOne(
            { _id: instance._id },
            { $set: { reminderSent: true } },
          );
          this.logger.log(
            `Sent reminder for instance ${instance._id} to ${emails.length} admins`,
          );
        }
      }
    } catch (err) {
      this.logger.error('Error processing email reminders', err as any);
    }
  }

  private computeSendTime(
    date: Date,
    startTime: string,
    reminderTimeBefore?: string,
  ) {
    try {
      const baseDate = new Date(date);
      const match = (startTime || '')
        .trim()
        .match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
      let hours = 0;
      let minutes = 0;
      if (match) {
        hours = parseInt(match[1], 10);
        minutes = parseInt(match[2], 10);
        const meridian = match[3].toUpperCase();
        if (meridian === 'AM' && hours === 12) {
          hours = 0;
        }
        if (meridian === 'PM' && hours !== 12) {
          hours += 12;
        }
      }
      baseDate.setHours(hours, minutes, 0, 0);

      if (!reminderTimeBefore) {
        return baseDate;
      }
      const map: Record<string, number> = {
        MINUTES_30: 30 * 60 * 1000,
        HOUR_1: 60 * 60 * 1000,
      };
      const offset = map[reminderTimeBefore] || 0;
      return new Date(baseDate.getTime() - offset);
    } catch (err) {
      this.logger.error('Failed to compute sendTime', err as any);
      return null;
    }
  }
}
