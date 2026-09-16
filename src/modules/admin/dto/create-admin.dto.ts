import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { TITLE_MAX_LENGTH } from '../../../common/utils/titles.constant';

export class CreateAdminDto {
  @IsOptional()
  @IsString()
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;

  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;
}
