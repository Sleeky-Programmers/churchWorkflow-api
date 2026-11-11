import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class GlobalSearchDto {
  @Transform(({ value }) => {
    return typeof value === 'string' ? value.trim() : value;
  })
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  q: string;

  @IsOptional()
  @Type(() => {
    return Number;
  })
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number = 5;
}
