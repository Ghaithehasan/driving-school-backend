import { Type } from 'class-transformer';
import { IsInt, IsPositive } from 'class-validator';

export class ConfirmBookingPaymentDto {
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  transactionId!: number;
}
