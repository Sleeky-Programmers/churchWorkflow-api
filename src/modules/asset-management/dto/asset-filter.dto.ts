import { IsEnum, IsOptional, IsString } from 'class-validator';

import { PaginationBaseDto } from '../../../common/helpers/pagination.helper';
import {
  AssetMaintenanceTypeFilter,
  AssetRisk,
  AssetStatus,
} from '../../../common/utils/enums.utils';

export class AssetFilterDto extends PaginationBaseDto {
  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsEnum(AssetRisk)
  risk?: AssetRisk;

  @IsOptional()
  @IsEnum(AssetStatus)
  status?: AssetStatus;

  @IsOptional()
  @IsEnum(AssetMaintenanceTypeFilter)
  type?: AssetMaintenanceTypeFilter;
}
