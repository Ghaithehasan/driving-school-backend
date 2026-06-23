import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Booking } from './booking.entity';
import { BookingCancellation } from './booking-cancellation.entity';
import { LessonPrice } from './lesson-price.entity';
import { Instructor } from '../instructors/instructor.entity';
import { InstructorWeeklyAvailability } from '../instructors/instructor-weekly-availability.entity';
import { InstructorUnavailablePeriod } from '../instructors/instructor-unavailable-period.entity';
import { InstructorSchedulePublication } from '../instructors/instructor-schedule-publication.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { VehicleUnavailablePeriod } from '../vehicles/vehicle-unavailable-period.entity';
import { Student } from '../students/student.entity';
import { StudentCharge } from '../payments/student-charge.entity';
import { StudentPayment } from '../payments/student-payment.entity';
import { Expense } from '../expenses/expense.entity';
import { ExpenseInstructor } from '../expenses/expense-instructor.entity';
import { InstructorPrice } from '../expenses/instructor-price.entity';
import { Setting } from '../settings/setting.entity';
import { User } from '../users/user.entity';
import { BookingService } from './booking.service';
import { ReceptionBookingController } from './reception-booking.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      BookingCancellation,
      LessonPrice,
      Instructor,
      InstructorWeeklyAvailability,
      InstructorUnavailablePeriod,
      InstructorSchedulePublication,
      Vehicle,
      VehicleUnavailablePeriod,
      Student,
      StudentCharge,
      StudentPayment,
      Expense,
      ExpenseInstructor,
      InstructorPrice,
      Setting,
      User,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [ReceptionBookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
