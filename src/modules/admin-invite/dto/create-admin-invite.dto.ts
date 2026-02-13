import { IsEmail, IsOptional } from 'class-validator';

export class CreateAdminInviteDto {
  @IsOptional()
  title: string;

  @IsOptional()
  firstName: string;

  @IsOptional()
  lastName: string;

  @IsEmail()
  email: string;
}
