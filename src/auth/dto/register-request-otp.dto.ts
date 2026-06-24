import {
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * الخطوة 1 من التسجيل: الفورم الكامل.
 * نتحقق من كل الحقول (اسم + رقم + باسورد) قبل إرسال الـ OTP،
 * حتى لو في خطأ يظهر للطالب قبل ما يروح لشاشة رمز التحقق وقبل ما نرسل SMS.
 */
export class RegisterRequestOtpDto {
  @IsString()
  @IsNotEmpty({ message: 'الاسم مطلوب' })
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty({ message: 'رقم الهاتف مطلوب' })
  @Length(10, 10, { message: 'رقم الهاتف يجب أن يكون 10 أرقام' })
  phone: string;

  @IsString()
  @IsNotEmpty({ message: 'كلمة المرور مطلوبة' })
  @MinLength(8, { message: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })
  password: string;
}
