import { IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateSuperAdminDto {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  churchRole: string;

  @IsOptional()
  churchName: string;

  @IsOptional()
  phoneNumber: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;
}
