import { IsArray, IsBoolean, IsEmail, IsInt, Min } from 'class-validator';

export class UpdateMaintenanceNotificationsDto {
  @IsBoolean()
  notificationsEnabled: boolean;

  @IsBoolean()
  notifyUpcoming: boolean;

  @IsBoolean()
  notifyDue: boolean;

  @IsBoolean()
  notifyOverdue: boolean;

  @IsInt()
  @Min(0)
  notifyDaysBefore: number;

  @IsArray()
  @IsEmail({}, { each: true })
  recipients: string[];
}
