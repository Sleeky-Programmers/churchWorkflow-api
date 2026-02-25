import {
  IsNotEmpty,
  IsMongoId,
  IsArray,
  ArrayMinSize,
  IsDateString,
} from 'class-validator';

export class CreateAttendanceDto {
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one attendee must be selected' })
  @IsMongoId({ each: true })
  attendees: string[];
}
