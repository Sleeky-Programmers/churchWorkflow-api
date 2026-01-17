import { IsNotEmpty, IsOptional } from 'class-validator';

export class ChurchIdentityDto {
  @IsNotEmpty()
  name: string;

  @IsOptional()
  alias: string;

  @IsOptional()
  address: string;

  @IsOptional()
  country: string;

  @IsOptional()
  state: string;

  @IsOptional()
  defaultCurrency: string;

  @IsOptional()
  timeZone: string;
}
