import { IsMongoId } from 'class-validator';

export class GrantBranchAccessDto {
  @IsMongoId()
  adminId: string;
}
