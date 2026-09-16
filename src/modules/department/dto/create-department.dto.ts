import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsMongoId,
  IsArray,
  IsEmail,
} from 'class-validator';

export class CreateDepartmentDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsMongoId()
  hod?: string;

  // Set instead of hod when creating the department with "invite new head".
  @IsOptional()
  @IsEmail()
  pendingHodEmail?: string;

  @IsOptional()
  @IsMongoId()
  assistantHod?: string;

  @IsOptional()
  @IsEmail()
  pendingAssistantHodEmail?: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  memberIds?: string[];
}
