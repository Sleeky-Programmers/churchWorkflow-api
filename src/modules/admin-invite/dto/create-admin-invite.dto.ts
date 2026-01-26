import { IsNotEmpty, IsOptional } from 'class-validator';

export class CreateAdminInviteDto {
  @IsOptional()
  title: string;

  @IsOptional()
  firstName: string;

  @IsOptional()
  lastName: string;

  @IsNotEmpty()
  email: string;
}
