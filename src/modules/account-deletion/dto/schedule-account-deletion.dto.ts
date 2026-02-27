import { IsDateString, IsOptional } from 'class-validator';

export class ScheduleAccountDeletionDto {
  @IsOptional()
  @IsDateString()
  executeAt?: Date;
}
