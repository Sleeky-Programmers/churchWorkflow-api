import { IsEmail, IsNotEmpty } from 'class-validator';

export class ProductAdminLoginDto {
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;
}
