import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
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

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9\s\-()]{7,20}$/, {
    message:
      'phoneNumber must be a valid phone number (7-20 digits, may start with + and contain spaces, dashes or parentheses)',
  })
  phoneNumber?: string;
}
