import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BookingCancellation } from '../booking/booking-cancellation.entity';
import { Booking } from '../booking/booking.entity';
import { Employee } from '../employees/employee.entity';
import { Expense } from '../expenses/expense.entity';
import { ExpenseVehicle } from '../expenses/expense-vehicle.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { VehicleUnavailablePeriod } from './vehicle-unavailable-period.entity';
import { Vehicle } from './vehicle.entity';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicle,
      VehicleUnavailablePeriod,
      Expense,
      ExpenseVehicle,
      Employee,
      Booking,
      BookingCancellation,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService],
})
export class VehiclesModule {}
