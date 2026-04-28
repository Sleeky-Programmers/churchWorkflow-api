import { IsOptional, IsString } from 'class-validator';
import { PaginationBaseDto } from '../../../common/helpers/pagination.helper';

export class AdminActivityLogFilterDto extends PaginationBaseDto {
  @IsOptional()
  @IsString()
  churchId?: string;

  @IsOptional()
  @IsString()
  adminId?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  plan?: string;
}
