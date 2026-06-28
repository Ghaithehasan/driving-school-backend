import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Instructor } from './instructor.entity';
import { InstructorWeeklyAvailability } from './instructor-weekly-availability.entity';
import { InstructorUnavailablePeriod } from './instructor-unavailable-period.entity';
import { InstructorPrice } from '../expenses/instructor-price.entity';
import { Booking } from '../booking/booking.entity';
import { BookingCancellation } from '../booking/booking-cancellation.entity';
import { Expense } from '../expenses/expense.entity';
import { ExpenseInstructor } from '../expenses/expense-instructor.entity';
import { Setting } from '../settings/setting.entity';
import { User } from '../users/user.entity';
import { InstructorsController } from './instructors.controller';
import { InstructorsService } from './instructors.service';
import { InstructorProfileController } from './instructor-profile.controller';
import { InstructorProfileService } from './instructor-profile.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Instructor,
      InstructorWeeklyAvailability,
      InstructorUnavailablePeriod,
      InstructorPrice,
      Booking,
      BookingCancellation,
      Expense,
      ExpenseInstructor,
      Setting,
      User,
    ]),
    AuthModule,
    NotificationsModule,
  ],
  controllers: [InstructorsController, InstructorProfileController],
  providers: [InstructorsService, InstructorProfileService],
})
export class InstructorsModule {}
