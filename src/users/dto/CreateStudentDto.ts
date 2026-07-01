import { IsNotEmpty, IsString, Length } from 'class-validator';

export class CreateStudentDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Length(10, 10)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
