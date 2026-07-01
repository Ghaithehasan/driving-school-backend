import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { BookingStatus } from '../../common/enums/index';

export class InstructorBookingsQueryDto {
  /** 'day' requires date; 'week' requires weekStart. */
  @IsIn(['day', 'week'])
  viewMode!: 'day' | 'week';

  @ValidateIf((o) => o.viewMode === 'day')
  @IsDateString({}, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  /** First day of the desired week (any weekday accepted — start is inclusive). */
  @ValidateIf((o) => o.viewMode === 'week')
  @IsDateString({}, { message: 'weekStart must be YYYY-MM-DD' })
  weekStart?: string;

  @IsOptional()
  @IsEnum(BookingStatus)
  bookingStatus?: BookingStatus;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  limit?: number;
}
