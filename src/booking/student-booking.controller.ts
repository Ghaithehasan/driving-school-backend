import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/guards/roles.guard';
import { BookingService } from './booking.service';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { ConfirmBookingPaymentDto } from './dto/confirm-booking-payment.dto';
import { CreateStudentBookingDto } from './dto/create-student-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { StudentCancelBookingDto } from './dto/student-cancel-booking.dto';

@Controller('student/bookings')
@UseGuards(PermissionGuard)
export class StudentBookingController {
  constructor(private readonly bookingService: BookingService) {}

  /** GET /student/bookings/available-slots */
  @Get('available-slots')
  @RequirePermissions('bookings.read')
  getAvailableSlots(@Query() query: AvailableSlotsQueryDto) {
    return this.bookingService.getAvailableSlots(query);
  }

  /** GET /student/bookings */
  @Get()
  @RequirePermissions('bookings.read')
  listMyBookings(
    @CurrentUser('userId') userId: number,
    @Query() query: ListBookingsQueryDto,
  ) {
    return this.bookingService.listMyBookings(userId, query);
  }

  /** POST /student/bookings */
  @Post()
  @RequirePermissions('bookings.create')
  createBooking(
    @CurrentUser('userId') userId: number,
    @Body() dto: CreateStudentBookingDto,
  ) {
    return this.bookingService.createStudentBooking(userId, dto);
  }

  /** GET /student/bookings/:id */
  @Get(':id')
  @RequirePermissions('bookings.read')
  getMyBookingDetail(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.bookingService.getMyBookingDetail(userId, id);
  }

  /** POST /student/bookings/:id/confirm-payment */
  @Post(':id/confirm-payment')
  @RequirePermissions('bookings.create')
  confirmPayment(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ConfirmBookingPaymentDto,
  ) {
    return this.bookingService.confirmStudentBookingPayment(userId, id, dto);
  }

  /** POST /student/bookings/:id/cancel */
  @Post(':id/cancel')
  @RequirePermissions('bookings.cancel-own')
  cancelOwnBooking(
    @CurrentUser('userId') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: StudentCancelBookingDto,
  ) {
    return this.bookingService.cancelOwnBooking(userId, id, dto);
  }
}
