import {
  IsEnum,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { GivingEntryPaymentMethod } from '../../../schemas/giving-entry.schema';

export class GivingEntryDto {
  @IsNotEmpty()
  @IsMongoId()
  offeringTypeId: string;

  @IsNotEmpty()
  @IsString()
  currencyCode: string;

  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  amount: number;

  @IsOptional()
  @IsEnum(GivingEntryPaymentMethod)
  paymentMethod?: GivingEntryPaymentMethod;

  @IsOptional()
  @IsString()
  note?: string;
}
