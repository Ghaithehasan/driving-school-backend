import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Length, Min } from 'class-validator';
import { RoleTitle } from '../../common/enums/index';

const EMPLOYEE_ROLES = [RoleTitle.RECEPTIONIST, RoleTitle.ACCOUNTANT] as const;
type EmployeeRole = typeof EMPLOYEE_ROLES[number];

export class CreateEmployeeDto {
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

  @IsEnum(EMPLOYEE_ROLES)
  role!: EmployeeRole;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlySalary?: number;

  // اختياري — لو ما أُرسل يُستخدم تاريخ اليوم
  @IsOptional()
  @IsDateString()
  hireDate?: string;
}
