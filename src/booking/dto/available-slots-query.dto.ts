import { IsEnum } from 'class-validator';
import { Gender, TrainingType, VehicleSource } from '../../common/enums/index';

export class AvailableSlotsQueryDto {
  @IsEnum(TrainingType)
  trainingType!: TrainingType;

  @IsEnum(VehicleSource)
  vehicleSource!: VehicleSource;

  @IsEnum(Gender)
  instructorGender!: Gender;
}
