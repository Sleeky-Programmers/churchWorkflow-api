import { IsNotEmpty, Matches } from 'class-validator';
import { WeeklyServiceDay } from '../../../common/utils/enums.utils';

export class CreateWeeklyServiceDto {
  @IsNotEmpty()
  serviceName: string;

  @IsNotEmpty()
  day: WeeklyServiceDay;

  @IsNotEmpty()
  @Matches(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, {
    message: 'Time must be in the format 8:30 AM',
  })
  startTime: string;

  @IsNotEmpty()
  @Matches(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, {
    message: 'Time must be in the format 8:30 AM',
  })
  endTime: string;

  @IsNotEmpty()
  location: string;
}
