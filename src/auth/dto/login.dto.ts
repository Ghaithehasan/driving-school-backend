import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  @MaxLength(20)
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @MaxLength(255)
  password: string;

  // اسم الجهاز اختياري — يساعد المستخدم يميّز جلساته (مثلاً "Chrome - Windows")
  @IsOptional()
  @IsString()
  @MaxLength(120)
  deviceName?: string;
}
