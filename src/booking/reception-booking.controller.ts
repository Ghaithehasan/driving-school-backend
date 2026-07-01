import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/roles.decorator';
import { PermissionGuard } from '../auth/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import { CreateReceptionBookingDto } from './dto/create-reception-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { BookingService } from './booking.service';

@Controller('reception/bookings')
@UseGuards(PermissionGuard)
export class ReceptionBookingController {
  constructor(private readonly bookingService: BookingService) { }

  /**
   * GET /reception/bookings/available-slots
   * Must be registered BEFORE /:id so NestJS doesn't swallow literal segments as id params.
   */
  @Get('available-slots')
  @RequirePermissions('bookings.read')
  getAvailableSlots(@Query() query: AvailableSlotsQueryDto) {
    return this.bookingService.getAvailableSlots(query);
  }

  /** GET /reception/bookings */
  @Get()
  @RequirePermissions('bookings.read')
  listBookings(@Query() query: ListBookingsQueryDto) {
    return this.bookingService.listBookings(query);
  }

  /** GET /reception/bookings/:id */
  @Get(':id')
  @RequirePermissions('bookings.read')
  getBookingDetail(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.bookingService.getBookingDetail(id, currentUser);
  }

  /** POST /reception/bookings */
  @Post()
  @RequirePermissions('bookings.create')
  createBooking(
    @Body() dto: CreateReceptionBookingDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.bookingService.createReceptionBooking(dto, currentUser);
  }

  /** POST /reception/bookings/:id/pay-remainder */
  @Post(':id/pay-remainder')
  @RequirePermissions('payments.create')
  payRemainder(@Param('id', ParseIntPipe) id: number) {
    return this.bookingService.payRemainder(id);
  }

  /** put /reception/bookings/:id/status — Manual override: COMPLETED or NO_SHOW */
  @Put(':id/status')
  @RequirePermissions('bookings.complete')
  updateBookingStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBookingStatusDto,
  ) {
    return this.bookingService.manualUpdateBookingStatus(id, dto.status);
  }

  /** POST /reception/bookings/:id/cancel */
  @Post(':id/cancel')
  @RequirePermissions('bookings.cancel')
  cancelBooking(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelBookingDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    return this.bookingService.cancelBooking(id, dto, currentUser);
  }
}
