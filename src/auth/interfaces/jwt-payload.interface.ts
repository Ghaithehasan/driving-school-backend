/**
 * محتوى الـ access token.
 * - sub: معرّف المستخدم (standard JWT claim واسمه "subject").
 * - roles: أدوار المستخدم، منحطها بالتوكن حتى الـ RolesGuard ما يحتاج يرجع للداتابيز بكل طلب.
 * - tokenVersion: نسخة التوكن، لو زادت بالداتابيز بتصير كل التوكنات القديمة غير صالحة.
 */
export interface AccessTokenPayload {
  sub: number;
  roles: string[];
  tokenVersion: number;
}

/**
 * محتوى الـ refresh token.
 * - sub: معرّف المستخدم.
 * - sessionId: معرّف الجلسة في جدول auth_sessions حتى نقدر نتحقق منها ونلغيها.
 */
export interface RefreshTokenPayload {
  sub: number;
  sessionId: number;
}

/**
 * محتوى توكن إعادة تعيين كلمة المرور (قصير العمر، يُصدَر بعد التحقق من الـ OTP).
 * - sub: معرّف المستخدم.
 * - purpose: غرض التوكن — حتى ما ينقبل توكن من نوع آخر في مسار الإعادة.
 */
export interface ResetTokenPayload {
  sub: number;
  purpose: string;
  tokenVersion: number;
}

/**
 * الشكل اللي بينحقن في req.user بعد ما يتحقق الـ JwtStrategy من الـ access token.
 */
export interface AuthenticatedUser {
  userId: number;
  roles: string[];
}

/**
 * بيانات الجهاز/الطلب المرافقة لعملية الدخول (تنخزن مع الجلسة).
 */
export interface SessionMeta {
  ip: string | null;
  userAgent: string | null;
  deviceName: string | null;
}
