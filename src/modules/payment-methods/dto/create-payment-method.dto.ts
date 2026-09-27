import { IsBoolean, IsEnum, IsInt, IsOptional } from 'class-validator';
import { GivingEntryPaymentMethod } from '../../../schemas/giving-entry.schema';

export class CreatePaymentMethodDto {
  @IsEnum(GivingEntryPaymentMethod)
  code: GivingEntryPaymentMethod;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
