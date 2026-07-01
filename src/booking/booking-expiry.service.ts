import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { BookingService } from './booking.service';

@Injectable()
export class BookingExpiryService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly bookingService: BookingService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleHolds(): Promise<void> {
    await this.dataSource.query(
      `UPDATE booking
       SET booking_status = 'EXPIRED'
       WHERE booking_status = 'PENDING_PAYMENT'
         AND locked_until <= now()`,
    );
  }

  @Cron('0 */15 * * * *')
  async autoCompleteExpiredLessons(): Promise<void> {
    await this.bookingService.processExpiredBookings();
  }
}
