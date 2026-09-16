import {
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateGivingRecordDto {
  @IsNotEmpty()
  @IsMongoId()
  churchServiceId: string;

  // 'YYYY-MM-DD'
  @IsNotEmpty()
  @IsString()
  date: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tithe?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  offering?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  specialOffering?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  thanksgivingOffering?: number;
}
