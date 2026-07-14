import { IsNotEmpty } from 'class-validator';

export class AdminRegisterDto {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  password: string;
}
