import {
  Injectable,
  InternalServerErrorException,
  NestMiddleware,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Request, Response, NextFunction } from 'express';
import { RateLimit } from '../schemas/rate-limit.schema';
import { Model } from 'mongoose';

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  constructor(
    @InjectModel(RateLimit.name)
    private readonly rateLimitModel: Model<RateLimit>,
  ) {}
  private readonly MAX_REQUESTS = 10;
  private readonly TIME_WINDOW = 60 * 1000;

  async use(req: Request, res: Response, next: NextFunction) {
    const clientIp = req.ip;
    const now = Date.now();

    try {
      const rateLimitRecord = await this.rateLimitModel.findOne({
        ip: clientIp,
      });

      if (!rateLimitRecord) {
        await this.rateLimitModel.create({
          ip: clientIp,
          count: 1,
          lastRequestAt: now,
        });
        return next();
      }

      const timeElapsed =
        now - new Date(rateLimitRecord.lastRequestAt).getTime();

      if (timeElapsed > this.TIME_WINDOW) {
        rateLimitRecord.count = 1;
        rateLimitRecord.lastRequestAt = new Date(now);
        await rateLimitRecord.save();
        return next();
      }

      if (rateLimitRecord.count >= this.MAX_REQUESTS) {
        return res
          .status(429)
          .json({ message: 'Too many requests, please try again later.' });
      }

      rateLimitRecord.count++;
      await rateLimitRecord.save();
      next();
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Internal server error.',
      );
    }
  }
}
