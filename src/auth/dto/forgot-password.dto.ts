import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ForgotPasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  @Length(10, 10, { message: 'رقم الهاتف يجب أن يكون 10 أرقام' })
  phone: string;
}
