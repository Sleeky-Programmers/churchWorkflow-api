import { IsNotEmpty, IsString } from 'class-validator';

export class RejectRequisitionDto {
  @IsNotEmpty()
  @IsString()
  reviewNote: string;
}
