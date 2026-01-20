import { IsNotEmpty } from 'class-validator';

export class ChurchIdentityDto {
  @IsNotEmpty()
  name: string;

  @IsNotEmpty()
  alias: string;

  @IsNotEmpty()
  address: string;

  @IsNotEmpty()
  country: string;

  @IsNotEmpty()
  state: string;

  @IsNotEmpty()
  defaultCurrency: string;

  @IsNotEmpty()
  timeZone: string;
}
