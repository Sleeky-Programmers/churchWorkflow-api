import { PartialType } from '@nestjs/mapped-types';
import { CreateSmallTeamDto } from './create-small-team.dto';

export class UpdateSmallTeamDto extends PartialType(CreateSmallTeamDto) {}
