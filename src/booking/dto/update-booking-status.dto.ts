import { IsIn } from 'class-validator';
import { BookingStatus } from '../../common/enums/index';

export class UpdateBookingStatusDto {
  @IsIn([BookingStatus.COMPLETED, BookingStatus.NO_SHOW])
  status!: BookingStatus.COMPLETED | BookingStatus.NO_SHOW;
}
