import { ChurchRole } from './../../../common/utils/enums.utils';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export class CreateAdminDto {
  @IsNotEmpty()
  firstName: string;

  @IsNotEmpty()
  lastName: string;

  @IsNotEmpty()
  @IsEnum(ChurchRole)
  churchRole: ChurchRole;

  @IsNotEmpty()
  churchName: string;

  @IsNotEmpty()
  phoneNumber: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;
}
