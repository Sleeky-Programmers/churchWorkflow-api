import { IsIn, IsOptional, IsString } from 'class-validator';
import { ChurchSubscriptionStatus } from 'src/common/utils/enums.utils';

import { PaginationBaseDto } from '../../../common/helpers/pagination.helper';

export class ChurchFilterDto extends PaginationBaseDto {
  @IsOptional()
  @IsString()
  plan?: string;

  @IsOptional()
  @IsIn(Object.values(ChurchSubscriptionStatus))
  subscriptionStatus?: ChurchSubscriptionStatus;
}
