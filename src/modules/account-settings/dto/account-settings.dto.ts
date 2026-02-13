import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PersonalPreferencesDto {
  @IsOptional()
  @IsBoolean()
  birthday?: boolean;

  @IsOptional()
  @IsBoolean()
  event?: boolean;

  @IsOptional()
  @IsBoolean()
  requisitionApproval?: boolean;
}

export class PersonalPrivacyDto {
  @IsOptional()
  @IsBoolean()
  birthdayCalendarDisplay?: boolean;

  @IsOptional()
  @IsBoolean()
  birthdayShoutOut?: boolean;

  @IsOptional()
  @IsBoolean()
  emailAlerts?: boolean;
}

export class AccountSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalPreferencesDto)
  personalPreferences?: PersonalPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PersonalPrivacyDto)
  personalPrivacy?: PersonalPrivacyDto;
}
