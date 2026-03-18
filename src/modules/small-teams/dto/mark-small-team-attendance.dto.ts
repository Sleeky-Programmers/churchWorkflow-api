import { ArrayUnique, IsArray, IsDateString, IsMongoId } from 'class-validator';

export class MarkSmallTeamAttendanceDto {
  @IsDateString()
  date: string;

  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  memberIds: string[];
}

