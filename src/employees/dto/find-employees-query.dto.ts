import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RoleTitle } from '../../common/enums/index';

const EMPLOYEE_ROLES = [RoleTitle.RECEPTIONIST, RoleTitle.ACCOUNTANT] as const;
type EmployeeRole = typeof EMPLOYEE_ROLES[number];

export class FindEmployeesQueryDto {
  @IsOptional()
  @IsEnum(EMPLOYEE_ROLES)
  role?: EmployeeRole;

  @IsOptional()
  @IsString()
  search?: string;
}
