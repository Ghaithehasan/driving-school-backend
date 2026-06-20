import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { User } from '../users/user.entity';
import { AuthSession } from './auth-session.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RolesGuard } from './guards/roles.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    // نسجّل الـ repositories اللي بنحتاجها داخل الموديول.
    TypeOrmModule.forFeature([User, UserRole, Role, AuthSession]),
    PassportModule,
    // نسجّل JwtModule فاضي — منمرّر الـ secret و expiresIn يدوياً عند كل توقيع،
    // لأنه عنا توكنين بسرّين مختلفين (access و refresh).
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard],
  exports: [AuthService],
})
export class AuthModule {}
