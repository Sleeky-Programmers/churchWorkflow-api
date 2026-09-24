import { PartialType } from '@nestjs/mapped-types';
import { CreateOfferingTypeDto } from './create-offering-type.dto';

export class UpdateOfferingTypeDto extends PartialType(CreateOfferingTypeDto) {}
