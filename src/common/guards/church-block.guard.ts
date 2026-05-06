import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ChurchService } from '../../modules/church/church.service';
import { ChurchStatus } from '../utils/enums.utils';

@Injectable()
export class ChurchBlockedGuard implements CanActivate {
  constructor(private churchService: ChurchService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return true;
    }

    if (!user.churchId) {
      return true;
    }

    const church = await this.churchService.findById(user.churchId);

    if (church?.status === ChurchStatus.BLOCKED) {
      throw new ForbiddenException(
        'Your church has been blocked. Contact support.',
      );
    }

    return true;
  }
}
