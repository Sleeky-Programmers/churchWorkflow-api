import { IsEnum, IsNotEmpty } from 'class-validator';
import { ModuleSections } from '../../../common/utils/enums.utils';

export class ActivityLogDto {
  @IsNotEmpty()
  action: string;

  @IsNotEmpty()
  @IsEnum(ModuleSections)
  module: ModuleSections;

  @IsNotEmpty()
  details: string;
}
