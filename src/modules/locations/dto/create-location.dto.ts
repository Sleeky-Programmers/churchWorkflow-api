import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export const LOCATION_MAX_LENGTH = 120;

export class CreateLocationDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(LOCATION_MAX_LENGTH)
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
