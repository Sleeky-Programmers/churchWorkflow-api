import { ArrayUnique, IsArray, IsMongoId } from 'class-validator';

export class UpdateSmallTeamMembersDto {
  @IsArray()
  @ArrayUnique()
  @IsMongoId({ each: true })
  memberIds: string[];
}

