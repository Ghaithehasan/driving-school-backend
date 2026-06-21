import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import type {
  AuthenticatedUser,
  SessionMeta,
} from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto.phone, dto.password, {
      ...this.extractMeta(req),
      deviceName: dto.deviceName ?? null,
    });
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RefreshTokenDto,
  ) {
    await this.authService.logout(user.userId, dto.refreshToken);
    return { message: 'تم تسجيل الخروج بنجاح' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: AuthenticatedUser) {
    await this.authService.logoutAll(user.userId);
    return { message: 'تم تسجيل الخروج من كل الأجهزة' };
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getProfile(user.userId);
  }

  @Get('me/permissions')
  myPermissions(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMyPermissions(user.userId);
  }

  private extractMeta(req: Request): SessionMeta {
    return {
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      deviceName: null,
    };
  }
}
