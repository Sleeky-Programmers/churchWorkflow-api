import { IsInt, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

interface PaginationMetaInterface {
  page: number;
  limit: number;
  itemCount: number;
}

export const paginationMeta = ({
  page,
  limit,
  itemCount,
}: PaginationMetaInterface) => {
  const totalPages = Math.ceil(itemCount / limit);

  return {
    page,
    limit,
    itemCount,
    totalPages,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
};

export class PaginationBaseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit?: number = 20;
}
