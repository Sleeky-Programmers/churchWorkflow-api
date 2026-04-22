import { IsOptional } from 'class-validator';
import { PaginationBaseDto } from '../../../common/helpers/pagination.helper';
import {
  PaymentStatus,
  PaymentTimeframe,
} from '../../../common/utils/enums.utils';

export class PaymentFilterDto extends PaginationBaseDto {
  @IsOptional()
  plan?: string;

  @IsOptional()
  status?: PaymentStatus;

  @IsOptional()
  timeframe?: PaymentTimeframe;
}
