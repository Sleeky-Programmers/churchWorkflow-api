// Update-member-status.dto.ts
import { IsEnum } from 'class-validator';

export enum MemberStatusAction {
  ACTIVATE = 'ACTIVATE',
  DEACTIVATE = 'DEACTIVATE',
}

export class UpdateMemberStatusDto {
  @IsEnum(MemberStatusAction)
  action: MemberStatusAction;
}
