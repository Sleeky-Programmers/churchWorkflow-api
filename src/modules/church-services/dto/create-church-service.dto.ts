import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsDateString,
  Matches,
  ValidateIf,
  ValidateNested,
  IsArray,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceDay, ServiceType } from '../../../common/utils/enums.utils';

class SpecialDayDto {
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsNotEmpty()
  @Matches(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, {
    message: 'Time must be in the format 8:30 AM',
  })
  startTime: string;

  @IsOptional()
  @Matches(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, {
    message: 'Time must be in the format 8:30 AM',
  })
  endTime?: string;
}

export class CreateChurchServiceDto {
  @IsNotEmpty()
  serviceName: string;

  @IsNotEmpty()
  @IsEnum(ServiceType)
  type: ServiceType;

  @ValidateIf((o) => o.type === ServiceType.REGULAR)
  @IsNotEmpty()
  @IsEnum(ServiceDay)
  day?: ServiceDay;

  @ValidateIf((o) => o.type === ServiceType.SPECIAL)
  @IsNotEmpty()
  @IsDateString()
  startDate?: string;

  @ValidateIf((o) => o.type === ServiceType.SPECIAL)
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ValidateIf((o) => o.type === ServiceType.SPECIAL)
  @IsOptional()
  description?: string;

  @ValidateIf((o) => o.type === ServiceType.SPECIAL)
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecialDayDto)
  @ArrayMinSize(1)
  specialDays?: SpecialDayDto[];

  @ValidateIf(
    (o) =>
      o.type === ServiceType.REGULAR ||
      (o.type === ServiceType.SPECIAL && !o.specialDays?.length),
  )
  @IsNotEmpty()
  @Matches(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, {
    message: 'Time must be in the format 8:30 AM',
  })
  startTime?: string;

  @ValidateIf((o) => o.type === ServiceType.REGULAR)
  @IsNotEmpty()
  @Matches(/^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i, {
    message: 'Time must be in the format 8:30 AM',
  })
  endTime?: string;

  @IsOptional()
  location?: string;
}
