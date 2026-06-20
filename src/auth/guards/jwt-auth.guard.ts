import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * بوّابة تحمي أي endpoint: لازم يجي معه access token صالح.
 * بتشغّل الـ JwtStrategy تلقائياً. لو فشل التحقق → 401 Unauthorized.
 *
 * الاستخدام: @UseGuards(JwtAuthGuard)
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
