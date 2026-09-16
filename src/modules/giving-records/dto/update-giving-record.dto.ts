import { PartialType } from '@nestjs/mapped-types';
import { CreateGivingRecordDto } from './create-giving-record.dto';

export class UpdateGivingRecordDto extends PartialType(CreateGivingRecordDto) {}
