import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class StudentCancelBookingDto {
  @IsString()
  @IsNotEmpty({ message: 'سبب الإلغاء مطلوب' })
  @MaxLength(255)
  cancellationReason!: string;
}
