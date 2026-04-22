import { PartialType } from '@nestjs/mapped-types';
import { CreateChurchServiceDto } from './create-church-service.dto';

export class UpdateChurchServiceDto extends PartialType(
  CreateChurchServiceDto,
) {}
