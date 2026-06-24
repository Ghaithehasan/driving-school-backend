import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  @Length(10, 10, { message: 'رقم الهاتف يجب أن يكون 10 أرقام' })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
  @Length(6, 6, { message: 'رمز التحقق يجب أن يكون 6 أرقام' })
  code: string;
}
