import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleTitle } from '../../common/enums/index';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * يتحقق إنه المستخدم عنده واحد على الأقل من الأدوار المطلوبة بالـ @Roles().
 * لازم ينحط بعد JwtAuthGuard حتى يكون req.user موجود.
 *
 * الاستخدام: @UseGuards(JwtAuthGuard, RolesGuard) + @Roles(RoleTitle.MANAGER)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // نقرأ الأدوار المطلوبة من الـ metadata (على مستوى الدالة أو الكلاس).
    const requiredRoles = this.reflector.getAllAndOverride<RoleTitle[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // لو ما في @Roles على الـ endpoint، يعني مفتوح لأي مستخدم مسجّل دخول.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthenticatedUser | undefined;

    const hasRole =
      !!user && requiredRoles.some((role) => user.roles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException('ليس لديك صلاحية للوصول لهذا المورد');
    }

    return true;
  }
}
