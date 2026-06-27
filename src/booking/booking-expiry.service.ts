import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';

@Injectable()
export class BookingExpiryService {
  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleHolds(): Promise<void> {
    await this.dataSource.query(
      `UPDATE booking
       SET booking_status = 'EXPIRED'
       WHERE booking_status = 'PENDING_PAYMENT'
         AND locked_until <= now()`,
    );
  }
}
