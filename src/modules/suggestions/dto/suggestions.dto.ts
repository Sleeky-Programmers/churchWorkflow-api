import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class UsageEventDto {
  @IsIn(['page', 'action'])
  kind: 'page' | 'action';

  @IsString()
  @MaxLength(200)
  key: string;

  // Page the person came from (pages only).
  @IsOptional()
  @IsString()
  @MaxLength(200)
  from?: string;

  // Seconds spent on the page they just left (pages only).
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(3600)
  seconds?: number;
}

export class TrackUsageDto {
  @IsArray()
  @ArrayMaxSize(25)
  @ValidateNested({ each: true })
  @Type(() => {
    return UsageEventDto;
  })
  events: UsageEventDto[];
}

export class SuggestionsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  current?: string;
}

export class DismissSuggestionDto {
  @IsString()
  @MaxLength(200)
  suggestionId: string;
}
