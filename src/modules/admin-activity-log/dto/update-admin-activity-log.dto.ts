import { IsOptional, IsString } from 'class-validator';
import { Types } from 'mongoose';

export class UpdateAdminActivityLogDto {
  @IsOptional()
  churchId?: Types.ObjectId | string;

  @IsOptional()
  adminId?: Types.ObjectId | string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  details?: string;

  @IsOptional()
  @IsString()
  plan?: string;
}
