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

  /**
   * Local 24-hour datetime in school timezone (UTC+3).
   * Format: "YYYY-MM-DD HH:MM"  e.g. "2026-07-01 08:00"
   * The service converts this to UTC before persisting.
   */
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/, {
    message: 'startAt must be "YYYY-MM-DD HH:MM" (24-hour school local time)',
  })
  startAt!: string;

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
