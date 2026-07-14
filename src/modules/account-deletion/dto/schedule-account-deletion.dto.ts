import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class ScheduleAccountDeletionDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  waitingPeriod: number;
}
