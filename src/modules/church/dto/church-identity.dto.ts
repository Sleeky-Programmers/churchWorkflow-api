import { IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

import { ChurchProduct } from '../../../common/utils/enums.utils';

export class ChurchIdentityDto {
  @IsNotEmpty()
  name: string;

  @IsOptional()
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

  // The product the church is signing up through. Defaults to Church
  // Workflow; the Service Timer app sends SERVICE_TIMER.
  @IsOptional()
  @IsEnum(ChurchProduct)
  product?: ChurchProduct;
}
