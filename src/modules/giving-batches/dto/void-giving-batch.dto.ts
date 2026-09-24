import { IsNotEmpty, IsString } from 'class-validator';

export class VoidGivingBatchDto {
  @IsNotEmpty()
  @IsString()
  voidReason: string;
}
