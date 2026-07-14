import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class BlockChurchDto {
  @IsNotEmpty()
  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UnblockChurchDto {
  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
