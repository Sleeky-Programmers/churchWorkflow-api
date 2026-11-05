import { IsNotEmpty, IsOptional } from 'class-validator';
import { Types } from 'mongoose';
import { NotificationType } from '../../../common/utils/enums.utils';

export class NotificationDto {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  body: string;

  @IsNotEmpty()
  type: NotificationType;

  // Omit to broadcast to the whole church.
  @IsOptional()
  recipientId?: Types.ObjectId | string | null;
}
