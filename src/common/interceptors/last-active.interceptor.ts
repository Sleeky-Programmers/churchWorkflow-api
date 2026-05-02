import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AdminService } from '../../modules/admin/admin.service';

@Injectable()
export class LastActiveInterceptor implements NestInterceptor {
  constructor(private adminService: AdminService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();

    if (request.user?._id) {
      await this.adminService.findByIdAndUpdate(request.user._id, {
        lastActive: new Date(),
      });
    }

    return next.handle();
  }
}
