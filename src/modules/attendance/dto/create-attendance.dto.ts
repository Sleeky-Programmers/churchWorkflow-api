import {
  IsNotEmpty,
  IsMongoId,
  IsArray,
  ArrayMinSize,
  IsDateString,
  IsBoolean,
  ValidateIf,
  IsOptional,
} from 'class-validator';

export class CreateAttendanceDto {
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsOptional()
  @IsBoolean()
  isAllPresent: boolean;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one member must be selected' })
  @IsMongoId({ each: true })
  @ValidateIf((o) => {
    return !o.isAllPresent;
  })
  memberIds: string[];
}
