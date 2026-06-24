import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { TrainingType, VehicleSource } from '../../common/enums/index';

export class CreateReceptionBookingDto {
  @IsNumber()
  @IsPositive()
  studentId!: number;

  @IsNumber()
  @IsPositive()
  instructorId!: number;

  /** Lesson date in school local time. Format: "YYYY-MM-DD"  e.g. "2026-07-01" */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be "YYYY-MM-DD"' })
  date!: string;

  /** Lesson start time in school local 24-hour time. Format: "HH:MM"  e.g. "08:00" */
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'time must be "HH:MM" (24-hour)' })
  time!: string;

  @IsEnum(TrainingType)
  trainingType!: TrainingType;

  @IsEnum(VehicleSource)
  vehicleSource!: VehicleSource;

  /**
   * Cash amount collected from the student.
   * - Required when the student has no available rebooking credit.
   * - Omit when credit exists — the server detects and transfers it automatically.
   * - Overpayment is allowed (recorded as-is, no cap).
   */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  collectedAmount?: number;
}
