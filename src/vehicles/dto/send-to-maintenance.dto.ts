import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SendToMaintenanceDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
