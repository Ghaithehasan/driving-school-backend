import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty({ message: 'الاسم مطلوب' })
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  @Length(10, 10, { message: 'رقم الهاتف يجب أن يكون 10 أرقام' })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'رمز التحقق مطلوب' })
  @Length(6, 6, { message: 'رمز التحقق يجب أن يكون 6 أرقام' })
  code: string;

  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
  password: string;

  // اسم الجهاز اختياري — يساعد المستخدم يميّز جلساته
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}
