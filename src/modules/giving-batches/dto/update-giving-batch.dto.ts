import { PartialType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateGivingBatchDto } from './create-giving-batch.dto';

export class UpdateGivingBatchDto extends PartialType(CreateGivingBatchDto) {
  // Required by the service layer (not by validation) when editing a batch
  // That is already confirmed - keeps a paper trail on financial edits.
  @IsOptional()
  @IsString()
  editReason?: string;
}
