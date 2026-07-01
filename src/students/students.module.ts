import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { BookingModule } from '../booking/booking.module';
import { Student } from './student.entity';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';

@Module({
  imports: [TypeOrmModule.forFeature([Student]), AuthModule, BookingModule],
  controllers: [StudentsController],
  providers: [StudentsService],
})
export class StudentsModule {}
