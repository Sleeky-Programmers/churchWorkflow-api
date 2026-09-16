import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator';
import { TITLE_MAX_LENGTH } from '../../../common/utils/titles.constant';

export class CreateAdminInviteDto {
  @IsOptional()
  @IsString()
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  firstName: string;

  @IsOptional()
  lastName: string;

  @IsEmail()
  email: string;
}
