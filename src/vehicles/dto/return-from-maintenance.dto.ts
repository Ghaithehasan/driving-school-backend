import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ExpenseStatus } from '../../common/enums/index';

export class ReturnFromMaintenanceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Type(() => Number)
  maintenanceCost!: number;

  @IsEnum(ExpenseStatus)
  expenseStatus!: ExpenseStatus;
}
