import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { VehicleType } from '../../common/enums/index';

export class CreateVehicleDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  plateNumber!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  model?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  color?: string;

  @IsEnum(VehicleType)
  type!: VehicleType;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  adminNotes?: string;
}
