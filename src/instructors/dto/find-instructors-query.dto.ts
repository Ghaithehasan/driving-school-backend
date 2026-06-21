import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Gender, InstructorType } from '../../common/enums/index';

export class FindInstructorsQueryDto {
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsEnum(InstructorType)
  instructorType?: InstructorType;

  @IsOptional()
  @IsString()
  search?: string;
}
