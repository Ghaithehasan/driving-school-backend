import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { IsNull, LessThan, Repository } from 'typeorm';
import { AccountStatus } from '../common/enums/index';
import { RolePermission } from '../roles/role-permission.entity';
import { UserRole } from '../roles/user-role.entity';
import { User } from '../users/user.entity';
import { AuthSession } from './auth-session.entity';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  SessionMeta,
} from './interfaces/jwt-payload.interface';

// رسالة موحّدة لكل أخطاء الدخول — حتى ما نكشف للمهاجم إذا الرقم غلط أو الباسوورد غلط.
const INVALID_CREDENTIALS = 'بيانات الدخول غير صحيحة';
const INVALID_SESSION = 'الجلسة غير صالحة أو منتهية';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(RolePermission)
    private readonly rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(AuthSession)
    private readonly sessionRepo: Repository<AuthSession>,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ===================== العمليات العامة (تستدعى من الكونترولر) =====================

  /**
   * تسجيل الدخول: تحقّق من الهوية، أنشئ جلسة، وأصدر التوكنات.
   */
  async login(
    phone: string,
    password: string,
    meta: SessionMeta,
  ): Promise<LoginResult> {
    const user = await this.userRepo.findOne({ where: { phone } });

    // 1) المستخدم غير موجود أو ما عنده كلمة سر مهيّأة.
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // 2) تحقّق من كلمة المرور مقابل الـ hash المخزّن.
    const passwordValid = await argon2.verify(user.passwordHash, password);
    if (!passwordValid) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // 3) تحقّق من حالة الحساب (المحظور/المؤرشف ممنوع يدخل).
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('هذا الحساب غير مفعّل، راجع الإدارة');
    }

    // 4) حمّل الأدوار والصلاحيات وأصدر التوكنات مع جلسة جديدة.
    const roles = await this.getUserRoles(user.id);
    const permissions = await this.getUserPermissions(user.id);
    const tokens = await this.issueTokensWithNewSession(user, roles, meta);

    return { ...tokens, user: this.buildUserPayload(user, roles, permissions) };
  }

  /**
   * تدوير التوكنات (Token Rotation): يعطي access + refresh جديدين مقابل refresh صالح،
   * ويُبطل القديم. هذا أأمن من إبقاء نفس الـ refresh token طوال عمره.
   */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const session = await this.sessionRepo.findOne({
      where: { id: payload.sessionId },
      relations: { user: true },
    });

    // الجلسة لازم تكون موجودة، غير ملغاة، وغير منتهية.
    if (
      !session ||
      session.revokedAt !== null ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException(INVALID_SESSION);
    }

    // تأكد إنه التوكن المُرسل هو فعلاً اللي مخزّنة بصمته بهالجلسة.
    const tokenMatches = await argon2.verify(
      session.refreshTokenHash,
      refreshToken,
    );
    if (!tokenMatches) {
      // التوكن مو مطابق = احتمال إعادة استخدام توكن قديم مسروق → ألغِ الجلسة فوراً.
      session.revokedAt = new Date();
      await this.sessionRepo.save(session);
      throw new UnauthorizedException(INVALID_SESSION);
    }

    const user = session.user;
    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('هذا الحساب غير مفعّل، راجع الإدارة');
    }

    // أعد إصدار التوكنات على نفس الجلسة (rotation).
    const roles = await this.getUserRoles(user.id);
    return this.rotateSessionTokens(session, user, roles);
  }

  /**
   * تسجيل الخروج من جلسة واحدة (الجهاز الحالي): يُبطل الجلسة المرتبطة بالـ refresh token.
   */
  async logout(userId: number, refreshToken: string): Promise<void> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.verifyRefreshToken(refreshToken);
    } catch {
      // حتى لو التوكن تالف، الـ logout عملية "آمنة الفشل" — ما منرمي خطأ.
      return;
    }

    const session = await this.sessionRepo.findOne({
      where: { id: payload.sessionId },
      relations: { user: true },
    });

    // تأكد إنه الجلسة تخص نفس المستخدم صاحب الـ access token.
    if (session && Number(session.user.id) === Number(userId) && !session.revokedAt) {
      session.revokedAt = new Date();
      await this.sessionRepo.save(session);
    }
  }

  /**
   * تسجيل الخروج من كل الأجهزة: يُبطل كل جلسات المستخدم،
   * ويرفع tokenVersion حتى تصير كل الـ access tokens الحالية غير صالحة فوراً.
   */
  async logoutAll(userId: number): Promise<void> {
    await this.sessionRepo.update(
      { user: { id: userId }, revokedAt: IsNull() },
      { revokedAt: new Date() },
    );
    await this.userRepo.increment({ id: userId }, 'tokenVersion', 1);
  }

  /**
   * بيانات المستخدم الحالي (للفرونت اند حتى يعرف مين مسجّل دخول وشو أدواره).
   */
  async getProfile(userId: number): Promise<AuthUserPayload> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException(INVALID_CREDENTIALS);
    const roles = await this.getUserRoles(user.id);
    const permissions = await this.getUserPermissions(userId);
    return this.buildUserPayload(user, roles, permissions);
  }

  async getMyPermissions(userId: number): Promise<string[]> {
    return this.getUserPermissions(userId);
  }

  // ===================== دوال مساعدة داخلية (private) =====================

  /** يجيب أسماء أدوار المستخدم من جدول user_roles. */
  private async getUserRoles(userId: number): Promise<string[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { user: { id: userId } },
      relations: { role: true },
    });
    return userRoles.map((ur) => ur.role.title);
  }

  /** يجيب كل الصلاحيات المرتبطة بأدوار المستخدم. */
  private async getUserPermissions(userId: number): Promise<string[]> {
    const rolePermissions = await this.rolePermissionRepo
      .createQueryBuilder('rp')
      .innerJoin('rp.role', 'role')
      .innerJoin(UserRole, 'ur', 'ur.role_id = role.id')
      .innerJoinAndSelect('rp.permission', 'permission')
      .where('ur.user_id = :userId', { userId })
      .getMany();

    const unique = [...new Set(rolePermissions.map((rp) => rp.permission.code))];
    return unique.sort();
  }

  /** ينشئ جلسة جديدة ويصدر access + refresh tokens مربوطين فيها. */
  private async issueTokensWithNewSession(
    user: User,
    roles: string[],
    meta: SessionMeta,
  ): Promise<TokenPair> {
    // ننشئ سطر الجلسة أولاً حتى ناخذ id نحطه داخل الـ refresh token.
    const session = this.sessionRepo.create({
      user: { id: user.id } as User,
      refreshTokenHash: 'pending',
      deviceName: meta.deviceName,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      expiresAt: this.getRefreshExpiryDate(),
    });
    await this.sessionRepo.save(session);

    return this.rotateSessionTokens(session, user, roles);
  }

  /**
   * يصدر زوج توكنات جديد لجلسة موجودة، ويخزّن بصمة الـ refresh الجديدة.
   * تُستخدم في الدخول وفي التدوير.
   */
  private async rotateSessionTokens(
    session: AuthSession,
    user: User,
    roles: string[],
  ): Promise<TokenPair> {
    const accessToken = await this.signAccessToken(user, roles);
    const refreshToken = await this.signRefreshToken(user.id, session.id);

    // ما نخزّن التوكن نفسه — نخزّن بصمته (نفس مبدأ كلمة السر).
    session.refreshTokenHash = await argon2.hash(refreshToken);
    session.expiresAt = this.getRefreshExpiryDate();
    await this.sessionRepo.save(session);

    return { accessToken, refreshToken };
  }

  private async signAccessToken(user: User, roles: string[]): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: Number(user.id),
      roles,
      tokenVersion: user.tokenVersion,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m',
    } as JwtSignOptions);
  }

  private async signRefreshToken(
    userId: number,
    sessionId: number,
  ): Promise<string> {
    const payload: RefreshTokenPayload = {
      sub: Number(userId),
      sessionId: Number(sessionId),
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES') ?? '7d',
    } as JwtSignOptions);
  }

  private async verifyRefreshToken(
    token: string,
  ): Promise<RefreshTokenPayload> {
    try {
      return await this.jwt.verifyAsync<RefreshTokenPayload>(token, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(INVALID_SESSION);
    }
  }

  /** تاريخ انتهاء الجلسة في الداتابيز = الآن + 7 أيام (يطابق عمر الـ refresh token). */
  private getRefreshExpiryDate(): Date {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + sevenDaysMs);
  }

  private buildUserPayload(user: User, roles: string[], permissions: string[]): AuthUserPayload {
    return {
      id: Number(user.id),
      name: user.name,
      phone: user.phone,
      mustChangePassword: user.mustChangePassword,
      roles,
      permissions,
    };
  }

  /**
   * تنظيف الجلسات المنتهية (يمكن استدعاؤها لاحقاً من cron job).
   */
  async purgeExpiredSessions(): Promise<void> {
    await this.sessionRepo.delete({ expiresAt: LessThan(new Date()) });
  }
}

// ===================== أنواع الإرجاع =====================

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUserPayload {
  id: number;
  name: string;
  phone: string;
  mustChangePassword: boolean;
  roles: string[];
  permissions: string[];
}

export interface LoginResult extends TokenPair {
  user: AuthUserPayload;
}
