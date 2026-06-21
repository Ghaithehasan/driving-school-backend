import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StudentStatus } from '../../common/enums/index';

export class FindStudentsQueryDto {
  @IsOptional()
  @IsEnum(StudentStatus)
  status?: StudentStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
