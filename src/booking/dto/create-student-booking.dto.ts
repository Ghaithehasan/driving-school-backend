import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  Matches,
} from 'class-validator';
import { TrainingType, VehicleSource } from '../../common/enums/index';

export class CreateStudentBookingDto {
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  instructorId!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be "YYYY-MM-DD"' })
  date!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'time must be "HH:MM" (24-hour)',
  })
  time!: string;

  @IsEnum(TrainingType)
  trainingType!: TrainingType;

  @IsEnum(VehicleSource)
  vehicleSource!: VehicleSource;
}
