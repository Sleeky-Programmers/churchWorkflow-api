import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CommentRequisitionDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  body: string;
}
