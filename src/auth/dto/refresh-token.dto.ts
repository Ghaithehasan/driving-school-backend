import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'الـ refresh token مطلوب' })
  refreshToken!: string;
}
