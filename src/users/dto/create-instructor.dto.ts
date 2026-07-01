import { IsNotEmpty, IsString, Length, IsEnum } from 'class-validator';
import { Gender, InstructorType } from '../../common/enums/index';

export class CreateInstructorDto {
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

  @IsEnum(Gender)
  @IsNotEmpty()
  gender!: Gender;

  @IsEnum(InstructorType)
  @IsNotEmpty()
  instructorType!: InstructorType;
}
