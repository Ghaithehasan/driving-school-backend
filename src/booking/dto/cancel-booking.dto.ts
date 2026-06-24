import { IsEnum, IsString, MaxLength } from 'class-validator';
import { CancellationParty } from '../../common/enums/index';

export class CancelBookingDto {
  @IsEnum(CancellationParty)
  cancellationParty!: CancellationParty;

  @IsString()
  @MaxLength(255)
  cancellationReason!: string;
}
