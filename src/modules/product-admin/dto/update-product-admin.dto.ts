import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateProductAdminDto {
  @IsOptional()
  @IsString({ message: 'Name must be a string' })
  @IsNotEmpty({ message: 'Name cannot be empty if provided' })
  name?: string;

  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email cannot be empty if provided' })
  email?: string;
}
