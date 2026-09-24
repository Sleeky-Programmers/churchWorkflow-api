import { IsMongoId, IsNotEmpty, IsString } from 'class-validator';

export class CheckDuplicateDto {
  @IsNotEmpty()
  @IsMongoId()
  churchServiceId: string;

  @IsNotEmpty()
  @IsString()
  date: string;
}
