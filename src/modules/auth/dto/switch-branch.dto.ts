import { IsMongoId } from 'class-validator';

export class SwitchBranchDto {
  @IsMongoId()
  branchId: string;
}
