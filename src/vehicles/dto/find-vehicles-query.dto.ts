import { IsEnum, IsOptional, IsString } from 'class-validator';
import { VehicleStatus, VehicleType } from '../../common/enums/index';

export class FindVehiclesQueryDto {
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional()
  @IsEnum(VehicleType)
  type?: VehicleType;

  @IsOptional()
  @IsString()
  search?: string;
}
