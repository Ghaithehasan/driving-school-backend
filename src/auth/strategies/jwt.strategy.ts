import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { AccountStatus } from '../../common/enums/index';
import { User } from '../../users/user.entity';
import {
  AccessTokenPayload,
  AuthenticatedUser,
} from '../interfaces/jwt-payload.interface';

/**
 * تتحقق من الـ access token في كل طلب محمي.
 * Passport يقرأ التوكن من ترويسة "Authorization: Bearer <token>"،
 * يتأكد من توقيعه وصلاحيته، وبعدين يستدعي validate().
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') as string,
    });
  }

  /**
   * بترجع القيمة اللي بتنحقن في req.user.
   * هون منعمل فحوصات أمنية إضافية أبعد من مجرد صحّة التوقيع.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });

    if (!user) {
      throw new UnauthorizedException();
    }

    // الحساب لازم يضل مفعّل — لو انحظر بعد إصدار التوكن، نرفضه فوراً.
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new UnauthorizedException('الحساب غير مفعّل');
    }

    // لو tokenVersion تغيّرت (مثلاً عمل logout-all أو غيّر كلمة السر)،
    // كل التوكنات القديمة تصير غير صالحة.
    if (payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('انتهت صلاحية الجلسة، سجّل دخول من جديد');
    }

    return { userId: Number(user.id), roles: payload.roles };
  }
}
