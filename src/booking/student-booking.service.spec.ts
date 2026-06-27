import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  ChargeReason,
  ChargeStatus,
  CancellationParty,
  PaymentStatus,
} from '../common/enums/index';
import { User } from '../users/user.entity';
import { ExpenseInstructor } from '../expenses/expense-instructor.entity';
import { BookingCancellation } from './booking-cancellation.entity';
import { Booking } from './booking.entity';
import { BookingService } from './booking.service';
import { StudentCharge } from '../payments/student-charge.entity';
import { StudentPayment } from '../payments/student-payment.entity';

function createService(em: Record<string, jest.Mock>) {
  const emptyRepo = {};
  const studentRepo = {
    findOne: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn(async (callback) => callback(em)),
    query: jest.fn(),
  };
  const notificationsService = {
    sendAsync: jest.fn(),
  };
  const shamcashService = {
    verifyTransaction: jest.fn(),
  };

  const service = new BookingService(
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    studentRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    emptyRepo as never,
    dataSource as never,
    notificationsService as never,
    shamcashService as never,
  );

  return {
    service,
    studentRepo,
    dataSource,
    notificationsService,
    shamcashService,
  };
}

describe('BookingService student booking actions', () => {
  it('forces student cancellation party and makes deposit non-refundable', async () => {
    const bookingId = 33;
    const userId = 10;
    const booking = {
      id: bookingId,
      bookingStatus: BookingStatus.BOOKED,
      paymentStatus: PaymentStatus.DEPOSIT_PAID,
      student: { user: { id: userId, name: 'Student' } },
    };
    const cancellingUser = { id: userId };
    const em = {
      findOne: jest.fn((entity) => {
        if (entity === Booking) return Promise.resolve(booking);
        if (entity === User) return Promise.resolve(cancellingUser);
        return Promise.resolve(null);
      }),
      update: jest.fn(),
      save: jest.fn(),
    };
    const { service, studentRepo, notificationsService } = createService(em);
    studentRepo.findOne.mockResolvedValue({ id: 1, user: { id: userId } });

    await expect(
      service.cancelOwnBooking(userId, bookingId, {
        cancellationReason: 'تغيير الموعد',
        cancellationParty: CancellationParty.SCHOOL,
      } as never),
    ).resolves.toEqual({
      message: 'تم إلغاء الحجز بنجاح',
      bookingId,
    });

    expect(em.update).toHaveBeenCalledWith(
      Booking,
      { id: bookingId },
      {
        bookingStatus: BookingStatus.CANCELLED,
        paymentStatus: PaymentStatus.DEPOSIT_NON_REFUNDABLE,
      },
    );
    expect(em.save).toHaveBeenCalledWith(
      BookingCancellation,
      expect.objectContaining({
        cancellationParty: CancellationParty.STUDENT,
        cancellationReason: 'تغيير الموعد',
        booking: { id: bookingId },
        cancelledByUser: cancellingUser,
      }),
    );
    expect(notificationsService.sendAsync).toHaveBeenCalledTimes(1);
  });

  it('returns 404 and does not update when the booking is not owned by the student', async () => {
    const bookingId = 33;
    const userId = 10;
    const booking = {
      id: bookingId,
      bookingStatus: BookingStatus.BOOKED,
      paymentStatus: PaymentStatus.DEPOSIT_PAID,
      student: { user: { id: 99, name: 'Other student' } },
    };
    const em = {
      findOne: jest.fn((entity) => {
        if (entity === Booking) return Promise.resolve(booking);
        if (entity === User) return Promise.resolve({ id: userId });
        return Promise.resolve(null);
      }),
      update: jest.fn(),
      save: jest.fn(),
    };
    const { service, studentRepo, notificationsService } = createService(em);
    studentRepo.findOne.mockResolvedValue({ id: 1, user: { id: userId } });

    await expect(
      service.cancelOwnBooking(userId, bookingId, {
        cancellationReason: 'تغيير الموعد',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(em.update).not.toHaveBeenCalled();
    expect(em.save).not.toHaveBeenCalled();
    expect(notificationsService.sendAsync).not.toHaveBeenCalled();
  });
});

describe('BookingService single lesson charge payment flow', () => {
  it('payRemainder adds a payment to the existing lesson charge without creating another charge', async () => {
    const bookingId = 44;
    const booking = {
      id: bookingId,
      bookingStatus: BookingStatus.BOOKED,
      paymentStatus: PaymentStatus.DEPOSIT_PAID,
      student: { id: 1, user: { id: 10 } },
      instructor: { id: 2 },
    };
    const charge = {
      id: 7,
      chargeReason: ChargeReason.LESSON,
      amountDue: '2500.00',
    };
    const em = {
      findOne: jest.fn((entity) => {
        if (entity === Booking) return Promise.resolve(booking);
        if (entity === StudentCharge) return Promise.resolve(charge);
        if (entity === ExpenseInstructor) return Promise.resolve({ id: 99 });
        return Promise.resolve(null);
      }),
      find: jest.fn(() => Promise.resolve([{ amountPaid: '500.00' }])),
      update: jest.fn(),
      save: jest.fn(),
    };
    const { service } = createService(em);

    await expect(service.payRemainder(bookingId)).resolves.toEqual({
      message: 'Lesson completed and payment recorded',
      bookingId,
    });

    expect(em.save).toHaveBeenCalledTimes(1);
    expect(em.save).toHaveBeenCalledWith(
      StudentPayment,
      expect.objectContaining({
        amountPaid: '2000.00',
        studentCharge: charge,
      }),
    );
    expect(em.update).toHaveBeenCalledWith(
      StudentCharge,
      { id: charge.id },
      { chargeStatus: ChargeStatus.PAID },
    );
    expect(em.update).toHaveBeenCalledWith(
      Booking,
      { id: bookingId },
      {
        paymentStatus: PaymentStatus.FULLY_PAID,
        bookingStatus: BookingStatus.COMPLETED,
      },
    );
  });

  it('payRemainder rejects when the single lesson charge is already fully paid', async () => {
    const bookingId = 44;
    const booking = {
      id: bookingId,
      bookingStatus: BookingStatus.BOOKED,
      paymentStatus: PaymentStatus.DEPOSIT_PAID,
      student: { id: 1, user: { id: 10 } },
      instructor: { id: 2 },
    };
    const charge = {
      id: 7,
      chargeReason: ChargeReason.LESSON,
      amountDue: '2500.00',
    };
    const em = {
      findOne: jest.fn((entity) => {
        if (entity === Booking) return Promise.resolve(booking);
        if (entity === StudentCharge) return Promise.resolve(charge);
        return Promise.resolve(null);
      }),
      find: jest.fn(() => Promise.resolve([{ amountPaid: '2500.00' }])),
      update: jest.fn(),
      save: jest.fn(),
    };
    const { service } = createService(em);

    await expect(service.payRemainder(bookingId)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(em.save).not.toHaveBeenCalled();
    expect(em.update).not.toHaveBeenCalled();
  });
});
