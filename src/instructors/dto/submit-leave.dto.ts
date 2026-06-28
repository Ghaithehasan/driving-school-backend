import {
  IsDateString,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class SubmitLeaveDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;

  /**
   * Full-day leave: receptionist picks a date, stored as 00:00→next-day 00:00.
   * Mutually exclusive with startAt/endAt.
   */
  @ValidateIf((o) => !o.startAt && !o.endAt)
  @IsDateString({}, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  /**
   * Hourly leave start — local wall-clock datetime "YYYY-MM-DDTHH:MM".
   * Required when date is absent.
   */
  @ValidateIf((o) => !o.date)
  @IsDateString({}, { message: 'startAt must be a valid datetime string' })
  startAt?: string;

  /**
   * Hourly leave end — local wall-clock datetime "YYYY-MM-DDTHH:MM".
   * Required when date is absent.
   */
  @ValidateIf((o) => !o.date)
  @IsDateString({}, { message: 'endAt must be a valid datetime string' })
  endAt?: string;
}
