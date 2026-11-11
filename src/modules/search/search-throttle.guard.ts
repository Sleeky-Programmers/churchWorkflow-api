import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';

const WINDOW_MS = 10_000;
const MAX_REQUESTS = 30;
const MAX_TRACKED_USERS = 5_000;

/**
 * Light per-user limit on GET /search (30 requests per 10 s). The client
 * debounces typing, so normal use stays far below this; it only stops a
 * runaway script. In-memory and per instance, which is enough for this.
 */
@Injectable()
export class SearchThrottleGuard implements CanActivate {
  private readonly hits = new Map<string, number[]>();

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const key = String(req.user?._id ?? req.ip ?? 'anonymous');
    const now = Date.now();

    const recent = (this.hits.get(key) ?? []).filter((t) => {
      return now - t < WINDOW_MS;
    });
    if (recent.length >= MAX_REQUESTS) {
      throw new HttpException(
        'Too many searches. Please wait a moment.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    recent.push(now);
    // Re-insert so Map order tracks the most recently active users.
    this.hits.delete(key);
    this.hits.set(key, recent);

    // Keep memory bounded: drop the least recently active user.
    if (this.hits.size > MAX_TRACKED_USERS) {
      const oldest = this.hits.keys().next().value;
      if (oldest !== undefined) {
        this.hits.delete(oldest);
      }
    }
    return true;
  }
}
