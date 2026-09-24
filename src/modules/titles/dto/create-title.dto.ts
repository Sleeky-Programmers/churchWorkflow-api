import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TITLE_MAX_LENGTH } from '../../../common/utils/titles.constant';

export class CreateTitleDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(TITLE_MAX_LENGTH)
  name: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
