import {
  IsEmail,
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { PaymentProvider } from '../../../common/utils/enums.utils';

export class InitializeGivingDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  amount: number;

  @IsNotEmpty()
  @IsString()
  currencyCode: string;

  @IsNotEmpty()
  @IsMongoId()
  offeringTypeId: string;

  @IsOptional()
  @IsString()
  donorName?: string;

  @IsOptional()
  @IsEmail()
  donorEmail?: string;

  @IsNotEmpty()
  @IsEnum(PaymentProvider)
  gateway: PaymentProvider;
}
