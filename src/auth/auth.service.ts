import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as argon2 from 'argon2';
import { DataSource, IsNull, LessThan, Repository } from 'typeorm';
import { AccountStatus, OtpPurpose } from '../common/enums/index';
import { RolePermission } from '../roles/role-permission.entity';
import { UserRole } from '../roles/user-role.entity';
import { User } from '../users/user.entity';
import { createStudentAccount } from '../users/create-student-account';
import { AuthOtpCode } from './auth-otp-code.entity';
import { AuthSession } from './auth-session.entity';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
  ResetTokenPayload,
  SessionMeta,
} from './interfaces/jwt-payload.interface';

const INVALID_CREDENTIALS = 'بيانات الدخول غير صحيحة';
const INVALID_SESSION = 'الجلسة غير صالحة أو منتهية';
const OTP_EXPIRY_MINUTES = 2;
const OTP_MAX_ATTEMPTS = 3;
const OTP_RESEND_COOLDOWN_SECONDS = 120;

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
    @InjectRepository(AuthOtpCode)
    private readonly otpRepo: Repository<AuthOtpCode>,
    private readonly dataSource: DataSource,
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
    if (
      session &&
      Number(session.user.id) === Number(userId) &&
      !session.revokedAt
    ) {
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

  /**
   * الخطوة 1: طلب إعادة تعيين كلمة المرور.
   * يتحقق من وجود الرقم وحالة الحساب، يلغي أي OTP سابق، ويولّد رمز جديد.
   */
  async forgotPassword(phone: string): Promise<ForgotPasswordResult> {
    const user = await this.userRepo.findOne({ where: { phone } });
    if (!user) {
      throw new BadRequestException('رقم الهاتف غير مسجّل في النظام');
    }

    if (user.accountStatus !== AccountStatus.ACTIVE) {
      throw new ForbiddenException('هذا الحساب غير مفعّل، راجع الإدارة');
    }

    const code = await this.issueOtp(phone, OtpPurpose.PASSWORD_RESET, user);

    return {
      message: `تم إرسال رمز التحقق إلى الرقم ${phone}، صالح لمدة ${OTP_EXPIRY_MINUTES} دقائق`,
      code,
    };
  }

  /**
   * الخطوة 2: التحقق من رمز الـ OTP.
   * لو الرمز صحيح وصالح، نستهلكه ونصدر resetToken قصير العمر
   * يسمح بالخطوة الأخيرة (تغيير كلمة المرور) — بدون إعادة إرسال الرمز.
   */
  async verifyOtp(phone: string, code: string): Promise<VerifyOtpResult> {
    const otp = await this.validateOtp(phone, OtpPurpose.PASSWORD_RESET, code);

    // الرمز صحيح — نستهلكه فوراً حتى ما ينعاد استخدامه.
    otp.consumedAt = new Date();
    await this.otpRepo.save(otp);

    if (!otp.user) {
      throw new BadRequestException('رمز التحقق غير صالح');
    }

    const resetToken = await this.signResetToken(
      otp.user.id,
      otp.user.tokenVersion,
    );
    return { resetToken };
  }

  // ===================== تسجيل الطالب (تطبيق الموبايل) =====================

  /**
   * الخطوة 1 من التسجيل: طلب رمز تحقق لرقم هاتف جديد.
   * يرفض إذا الرقم مسجّل مسبقاً، ويولّد OTP بغرض تأكيد الهاتف.
   */
  async registerRequestOtp(phone: string): Promise<ForgotPasswordResult> {
    const existing = await this.userRepo.findOne({ where: { phone } });
    if (existing) {
      throw new ConflictException(
        'رقم الهاتف لديه حساب مسبقاً، الرجاء تسجيل الدخول',
      );
    }

    // الـ OTP هنا مرتبط بالرقم فقط (لا يوجد مستخدم بعد).
    const code = await this.issueOtp(
      phone,
      OtpPurpose.PHONE_VERIFICATION,
      null,
    );

    return {
      message: `تم إرسال رمز التحقق إلى الرقم ${phone}، صالح لمدة ${OTP_EXPIRY_MINUTES} دقائق`,
      code,
    };
  }

  /**
   * الخطوة 2 من التسجيل: تأكيد الـ OTP وإنشاء حساب الطالب وتسجيل دخوله فوراً.
   * استهلاك الـ OTP وإنشاء الحساب يتمّان ضمن transaction واحد (ذرّي).
   */
  async registerStudent(
    input: RegisterStudentInput,
    meta: SessionMeta,
  ): Promise<LoginResult> {
    // 1) تحقّق من الـ OTP بدون استهلاكه (سيُستهلَك داخل الـ transaction).
    const otp = await this.validateOtp(
      input.phone,
      OtpPurpose.PHONE_VERIFICATION,
      input.code,
    );

    const passwordHash = await argon2.hash(input.password);

    // 2) ذرّياً: استهلك الـ OTP وأنشئ الحساب — لو فشل أحدهما يرجع كلاهما.
    const { user } = await this.dataSource.transaction(async (manager) => {
      await manager.update(
        AuthOtpCode,
        { id: otp.id },
        { consumedAt: new Date() },
      );
      return createStudentAccount(manager, {
        name: input.name,
        phone: input.phone,
        passwordHash,
        mustChangePassword: false, // الطالب حطّ كلمة مروره بنفسه
      });
    });

    // 3) تسجيل دخول تلقائي — أصدر التوكنات مع جلسة جديدة.
    const roles = await this.getUserRoles(user.id);
    const permissions = await this.getUserPermissions(user.id);
    const tokens = await this.issueTokensWithNewSession(user, roles, meta);

    return { ...tokens, user: this.buildUserPayload(user, roles, permissions) };
  }

  /**
   * الخطوة 3: تغيير كلمة المرور مقابل resetToken صالح (الصادر من verifyOtp).
   * يغيّر كلمة السر ويُبطل كل الجلسات القائمة.
   */
  async resetPassword(
    resetToken: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const payload = await this.verifyResetToken(resetToken);

    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new BadRequestException('رمز إعادة التعيين غير صالح');
    }

    if (payload.tokenVersion !== user.tokenVersion) {
      throw new BadRequestException('رمز إعادة التعيين مستخدم مسبقاً');
    }

    const passwordHash = await argon2.hash(newPassword);

    await this.dataSource.transaction(async (manager) => {
      // تغيير كلمة المرور
      await manager.update(
        User,
        { id: user.id },
        {
          passwordHash,
          mustChangePassword: false,
        },
      );

      // إبطال كل الجلسات مشان أي حدا سارق الحساب يطلع فوراً
      await manager.update(
        AuthSession,
        { user: { id: user.id }, revokedAt: IsNull() },
        { revokedAt: new Date() },
      );

      // رفع tokenVersion حتى كل الـ access tokens الحالية تصير غير صالحة
      await manager.increment(User, { id: user.id }, 'tokenVersion', 1);
    });

    return { message: 'تم تغيير كلمة المرور بنجاح' };
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

    const unique = [
      ...new Set(rolePermissions.map((rp) => rp.permission.code)),
    ];
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

  private generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * يولّد رمز OTP جديد لرقم وغرض معيّن، ويخزّن بصمته، ويُلغي أي رمز سابق.
   * يطبّق فترة تهدئة (cooldown) لمنع إغراق الرقم برسائل.
   * يرجّع الرمز الخام (حالياً للتطوير — لاحقاً يُرسَل عبر SMS).
   */
  private async issueOtp(
    phone: string,
    purpose: OtpPurpose,
    user: User | null,
  ): Promise<string> {
    const recentOtp = await this.otpRepo.findOne({
      where: { phone, purpose, consumedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });

    if (recentOtp) {
      const secondsSinceCreation =
        (Date.now() - recentOtp.createdAt.getTime()) / 1000;
      if (secondsSinceCreation < OTP_RESEND_COOLDOWN_SECONDS) {
        throw new BadRequestException('يرجى الانتظار قبل طلب رمز جديد');
      }
    }

    const code = this.generateOtpCode();
    const codeHash = await argon2.hash(code);

    await this.dataSource.transaction(async (manager) => {
      // إلغاء أي رمز سابق غير مستهلك لنفس الرقم والغرض
      await manager.update(
        AuthOtpCode,
        { phone, purpose, consumedAt: IsNull() },
        { consumedAt: new Date() },
      );
      // حفظ الرمز الجديد
      await manager.save(
        manager.create(AuthOtpCode, {
          phone,
          user,
          codeHash,
          purpose,
          expiresAt: new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000),
          attemptsCount: 0,
        }),
      );
    });

    return code;
  }

  /**
   * يتحقق من صحّة رمز OTP (موجود، غير منتهي، ضمن حدّ المحاولات، مطابق).
   * يزيد عدّاد المحاولات عند الخطأ. لا يستهلك الرمز — المُستدعي مسؤول عن الاستهلاك.
   * يرجّع سطر الـ OTP (مع علاقة الـ user) عند النجاح.
   */
  private async validateOtp(
    phone: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<AuthOtpCode> {
    const otp = await this.otpRepo.findOne({
      where: { phone, purpose, consumedAt: IsNull() },
      relations: { user: true },
      order: { createdAt: 'DESC' },
    });

    if (!otp) {
      throw new BadRequestException('رمز التحقق غير صالح أو منتهي');
    }

    if (otp.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException(
        'انتهت صلاحية رمز التحقق، اطلب رمزاً جديداً',
      );
    }

    if (otp.attemptsCount >= OTP_MAX_ATTEMPTS) {
      otp.consumedAt = new Date();
      await this.otpRepo.save(otp);
      throw new BadRequestException(
        'تم تجاوز عدد المحاولات المسموحة، اطلب رمزاً جديداً',
      );
    }

    const codeValid = await argon2.verify(otp.codeHash, code);
    if (!codeValid) {
      otp.attemptsCount += 1;
      await this.otpRepo.save(otp);
      throw new BadRequestException('رمز التحقق غير صحيح');
    }

    return otp;
  }

  /** سرّ توقيع توكن إعادة التعيين — منفصل عن سرّ الـ access حتى ما ينخلط الغرض. */
  private getResetSecret(): string {
    return (
      this.config.get<string>('JWT_RESET_SECRET') ??
      `${this.config.get<string>('JWT_ACCESS_SECRET')}_reset`
    );
  }

  private async signResetToken(
    userId: number,
    tokenVersion: number,
  ): Promise<string> {
    const payload: ResetTokenPayload = {
      sub: Number(userId),
      purpose: OtpPurpose.PASSWORD_RESET,
      tokenVersion,
    };
    return this.jwt.signAsync(payload, {
      secret: this.getResetSecret(),
      expiresIn: '10m',
    } as JwtSignOptions);
  }

  private async verifyResetToken(token: string): Promise<ResetTokenPayload> {
    let payload: ResetTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<ResetTokenPayload>(token, {
        secret: this.getResetSecret(),
      });
    } catch {
      throw new BadRequestException('رمز إعادة التعيين غير صالح أو منتهي');
    }
    // تأكد إنه الغرض صحيح — حتى ما ينقبل توكن من نوع تاني.
    if (payload.purpose !== OtpPurpose.PASSWORD_RESET) {
      throw new BadRequestException('رمز إعادة التعيين غير صالح');
    }
    return payload;
  }

  private getRefreshExpiryDate(): Date {
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return new Date(Date.now() + sevenDaysMs);
  }

  private buildUserPayload(
    user: User,
    roles: string[],
    permissions: string[],
  ): AuthUserPayload {
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

export interface ForgotPasswordResult {
  message: string;
  code?: string;
}

export interface VerifyOtpResult {
  resetToken: string;
}

export interface RegisterStudentInput {
  name: string;
  phone: string;
  code: string;
  password: string;
}
