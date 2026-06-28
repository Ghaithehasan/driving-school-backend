import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { DayOfWeek } from '../../common/enums/index';

const TIME_PATTERN = /^\d{2}:\d{2}$/;

export class PeriodDto {
  @IsString()
  @Matches(TIME_PATTERN, { message: 'startTime must be HH:MM' })
  startTime!: string;

  @IsString()
  @Matches(TIME_PATTERN, { message: 'endTime must be HH:MM' })
  endTime!: string;
}

export class UpdateDayScheduleDto {
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;

  /** Empty array = instructor does not work this weekday (recurring day-off). */
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => PeriodDto)
  periods!: PeriodDto[];
}
