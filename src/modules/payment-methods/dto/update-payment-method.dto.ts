import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class UpdatePaymentMethodDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}
