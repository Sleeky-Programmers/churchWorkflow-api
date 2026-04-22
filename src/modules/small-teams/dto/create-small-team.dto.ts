import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SmallTeamStatus } from '../../../common/utils/enums.utils';

export class CreateSmallTeamDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsMongoId()
  leaderId?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  memberIds?: string[];

  @IsOptional()
  @IsEnum(SmallTeamStatus)
  status?: SmallTeamStatus;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}
