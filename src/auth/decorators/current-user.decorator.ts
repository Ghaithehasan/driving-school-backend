import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';

/**
 * يستخرج المستخدم الحالي (req.user) ويحقنه كـ parameter في الكونترولر.
 * بدل ما تكتب @Req() req وتطلع req.user يدوياً.
 *
 * الاستخدام: getProfile(@CurrentUser() user: AuthenticatedUser)
 * أو لجلب حقل واحد: @CurrentUser('userId') userId: number
 */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser;
    return data ? user?.[data] : user;
  },
);
