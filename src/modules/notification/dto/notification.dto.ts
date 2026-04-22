import { IsNotEmpty } from 'class-validator';
import { NotificationType } from '../../../common/utils/enums.utils';

export class NotificationDto {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  body: string;

  @IsNotEmpty()
  type: NotificationType;
}
