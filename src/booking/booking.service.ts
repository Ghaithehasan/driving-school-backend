import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  BookingStatus,
  CancellationParty,
  ChargeReason,
  ChargeStatus,
  DayOfWeek,
  ExpenseCategory,
  ExpenseStatus,
  Gender,
  InstructorPriceType,
  InstructorType,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  RoleTitle,
  TrainingType,
  VehicleSource,
  VehicleStatus,
  VehicleType,
} from '../common/enums/index';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
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
import { NotificationsService } from '../notifications/notifications.service';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { CreateReceptionBookingDto } from './dto/create-reception-booking.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';

// JavaScript getDay()/getUTCDay() → DayOfWeek enum mapping (0=Sunday)
const JS_DAY_MAP: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUN,
  1: DayOfWeek.MON,
  2: DayOfWeek.TUE,
  3: DayOfWeek.WED,
  4: DayOfWeek.THU,
  5: DayOfWeek.FRI,
  6: DayOfWeek.SAT,
};

const ARABIC_DAY_NAMES: Record<number, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

// UTC+3 offset used ONLY for deriving a "local now" value to compare against
// TIMESTAMP WITHOUT TIME ZONE columns (which store local wall-clock).
// The Node.js process is expected to run in UTC; new Date() returns actual UTC.
const SCHOOL_TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class BookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingCancellation)
    private readonly cancellationRepo: Repository<BookingCancellation>,
    @InjectRepository(LessonPrice)
    private readonly lessonPriceRepo: Repository<LessonPrice>,
    @InjectRepository(Instructor)
    private readonly instructorRepo: Repository<Instructor>,
    @InjectRepository(InstructorWeeklyAvailability)
    private readonly weeklyAvailRepo: Repository<InstructorWeeklyAvailability>,
    @InjectRepository(InstructorUnavailablePeriod)
    private readonly instrUnavailRepo: Repository<InstructorUnavailablePeriod>,
    @InjectRepository(InstructorSchedulePublication)
    private readonly schedPubRepo: Repository<InstructorSchedulePublication>,
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(VehicleUnavailablePeriod)
    private readonly vehicleUnavailRepo: Repository<VehicleUnavailablePeriod>,
    @InjectRepository(Student)
    private readonly studentRepo: Repository<Student>,
    @InjectRepository(StudentCharge)
    private readonly chargeRepo: Repository<StudentCharge>,
    @InjectRepository(StudentPayment)
    private readonly paymentRepo: Repository<StudentPayment>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(ExpenseInstructor)
    private readonly expInstRepo: Repository<ExpenseInstructor>,
    @InjectRepository(InstructorPrice)
    private readonly instrPriceRepo: Repository<InstructorPrice>,
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Private Utilities ──────────────────────────────────────────────────────

  private async getNumericSetting(key: string, fallback: number): Promise<number> {
    const s = await this.settingRepo.findOne({ where: { key } });
    if (!s) return fallback;
    return parseFloat(s.value);
  }

  private async getEffectiveLessonPrice(
    instructorGender: Gender,
    trainingType: TrainingType,
    vehicleSource: VehicleSource,
    asOf: Date,
  ): Promise<number> {
    const dateStr = asOf.toISOString().split('T')[0];
    const lp = await this.lessonPriceRepo
      .createQueryBuilder('lp')
      .where('lp.instructorGender = :gender', { gender: instructorGender })
      .andWhere('lp.trainingType = :tt', { tt: trainingType })
      .andWhere('lp.vehicleSource = :vs', { vs: vehicleSource })
      .andWhere('lp.effectiveFrom <= :asOf', { asOf: dateStr })
      .orderBy('lp.effectiveFrom', 'DESC')
      .getOne();

    if (!lp) throw new BadRequestException('Lesson price not configured for this combination');
    return parseFloat(lp.price);
  }

  private async getEffectiveInstructorPrice(
    instructorGender: Gender,
    asOf: Date,
  ): Promise<number> {
    const type =
      instructorGender === Gender.MALE
        ? InstructorPriceType.MALE
        : InstructorPriceType.FEMALE;
    const dateStr = asOf.toISOString().split('T')[0];
    const ip = await this.instrPriceRepo
      .createQueryBuilder('ip')
      .where('ip.type = :type', { type })
      .andWhere('ip.effectiveFrom <= :asOf', { asOf: dateStr })
      .orderBy('ip.effectiveFrom', 'DESC')
      .getOne();

    if (!ip) throw new BadRequestException('Instructor price not configured');
    return parseFloat(ip.price);
  }

  /** Extracts display strings from local-wall-clock Date objects.
   *  Columns are TIMESTAMP WITHOUT TIME ZONE, so UTC methods return local values directly. */
  private toLocalSlot(start: Date, end: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      date:      start.toISOString().slice(0, 10),
      dayName:   ARABIC_DAY_NAMES[start.getUTCDay()],
      startTime: `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}`,
      endTime:   `${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`,
    };
  }

  private calcChargeStatus(amountDue: number, totalPaid: number): ChargeStatus {
    if (totalPaid === 0) return ChargeStatus.UNPAID;
    if (totalPaid >= amountDue) return ChargeStatus.PAID;
    return ChargeStatus.PARTIALLY_PAID;
  }

  /** Checks whether a (start,end) slot overlaps with the given period. */
  private overlaps(
    slotStart: Date,
    slotEnd: Date,
    periodStart: Date,
    periodEnd: Date | null,
  ): boolean {
    if (periodEnd === null) {
      // Open-ended period — overlaps if period started before slot ends
      return periodStart < slotEnd;
    }
    return periodStart < slotEnd && periodEnd > slotStart;
  }

  // ─── 0. CHECK STUDENT REBOOKING CREDIT ─────────────────────────────────────

  /**
   * Called by the frontend when a receptionist selects a student.
   * Returns whether the student has an unused deposit from a previous
   * cancelled booking, so the form can hide/show the cash amount field.
   */
  async checkStudentCredit(studentId: number) {
    const credit = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoin('b.student', 's')
      .where('s.id = :sid', { sid: studentId })
      .andWhere('b.bookingStatus = :status', { status: BookingStatus.CANCELLED })
      .andWhere('b.paymentStatus = :ps', {
        ps: PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING,
      })
      .orderBy('b.createdAt', 'DESC')
      .getOne();

    if (!credit) return { hasCredit: false };

    // Sum what was actually paid on the deposit charge of the cancelled booking
    const charge = await this.chargeRepo.findOne({
      where: { booking: { id: credit.id }, chargeReason: ChargeReason.LESSON_DEPOSIT },
    });
    const payments = charge
      ? await this.paymentRepo.find({ where: { studentCharge: { id: charge.id } } })
      : [];
    const paidAmount = payments.reduce(
      (sum, p) => sum + parseFloat(p.amountPaid.toString()),
      0,
    );

    return {
      hasCredit: true,
      creditFromBookingId: credit.id,
      creditAmount: paidAmount.toFixed(2),
    };
  }

  // ─── 1. LIST BOOKINGS ───────────────────────────────────────────────────────

  async listBookings(query: ListBookingsQueryDto) {
    const { bookingStatus, search } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.bookingRepo
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.student', 's')
      .innerJoinAndSelect('s.user', 'su')
      .innerJoinAndSelect('b.instructor', 'i')
      .innerJoinAndSelect('i.user', 'iu')
      .leftJoinAndSelect('b.vehicle', 'v');

    if (bookingStatus) {
      qb.andWhere('b.bookingStatus = :bookingStatus', { bookingStatus });
    }

    if (search) {
      // Searches student name OR instructor name
      qb.andWhere(
        '(su.name ILIKE :search OR iu.name ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('b.startAt', 'DESC').skip(skip).take(limit);

    const [bookings, total] = await qb.getManyAndCount();

    // ── Remaining-amount enrichment ─────────────────────────────────────────
    // Only BOOKED + DEPOSIT_PAID bookings need this; everything else gets null.

    const payableIds = bookings
      .filter(
        (b) =>
          b.bookingStatus === BookingStatus.BOOKED &&
          b.paymentStatus === PaymentStatus.DEPOSIT_PAID,
      )
      .map((b) => b.id);

    // 1) Total paid per booking — one aggregation query for the whole page
    const totalPaidMap = new Map<number, number>();
    if (payableIds.length > 0) {
      const rows: { bookingId: number; totalPaid: string }[] =
        await this.dataSource.query(
          `SELECT sc.booking_id AS "bookingId",
                  COALESCE(SUM(sp.amount_paid), 0) AS "totalPaid"
           FROM   student_charges sc
           LEFT JOIN student_payments sp ON sp.student_charge_id = sc.id
           WHERE  sc.booking_id = ANY($1)
           GROUP  BY sc.booking_id`,
          [payableIds],
        );
      for (const r of rows) {
        totalPaidMap.set(Number(r.bookingId), parseFloat(r.totalPaid));
      }
    }

    // 2) Effective lesson price per unique (gender, trainingType, vehicleSource, createdAt)
    //    A school rarely has more than 4-6 unique combos on one page.
    const priceCache = new Map<string, number>();
    const payableSet = new Set(payableIds);
    for (const b of bookings) {
      if (!payableSet.has(b.id)) continue;
      const key = `${b.instructor.gender}|${b.trainingType}|${b.vehicleSource}|${b.createdAt.toISOString().split('T')[0]}`;
      if (!priceCache.has(key)) {
        const price = await this.getEffectiveLessonPrice(
          b.instructor.gender,
          b.trainingType,
          b.vehicleSource,
          b.createdAt,
        );
        priceCache.set(key, price);
      }
    }

    return {
      data: bookings.map((b) => {
        const { date, dayName, startTime, endTime } = this.toLocalSlot(b.startAt, b.endAt);

        let remainingAmount: string | null = null;
        if (payableSet.has(b.id)) {
          const key = `${b.instructor.gender}|${b.trainingType}|${b.vehicleSource}|${b.createdAt.toISOString().split('T')[0]}`;
          const fullPrice = priceCache.get(key) ?? 0;
          const paid = totalPaidMap.get(b.id) ?? 0;
          const rem = Math.round((fullPrice - paid) * 100) / 100;
          remainingAmount = rem > 0 ? rem.toFixed(2) : null;
        }

        return {
          id: b.id,
          studentName: b.student.user.name,
          instructorName: b.instructor.user.name,
          trainingType: b.trainingType,
          vehicleSource: b.vehicleSource,
          vehiclePlate: b.vehicle?.plateNumber ?? null,
          date,
          dayName,
          startTime,
          endTime,
          bookingStatus: b.bookingStatus,
          paymentStatus: b.paymentStatus,
          remainingAmount,
        };
      }),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── 2. BOOKING DETAIL ──────────────────────────────────────────────────────

  async getBookingDetail(id: number, currentUser: AuthenticatedUser) {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: {
        student: { user: true },
        instructor: { user: true },
        vehicle: true,
      },
    });

    if (!booking) throw new NotFoundException('Booking not found');

    const charges = await this.chargeRepo.find({
      where: { booking: { id } },
    });

    const chargeIds = charges.map((c) => c.id);

    // Load payments with studentCharge relation populated for grouping
    const paymentsWithCharge =
      chargeIds.length > 0
        ? await this.paymentRepo
            .createQueryBuilder('p')
            .innerJoinAndSelect('p.studentCharge', 'sc')
            .where('sc.id IN (:...chargeIds)', { chargeIds })
            .getMany()
        : [];

    const chargePaymentMap = new Map<number, StudentPayment[]>();
    for (const p of paymentsWithCharge) {
      const cid = p.studentCharge.id;
      if (!chargePaymentMap.has(cid)) chargePaymentMap.set(cid, []);
      chargePaymentMap.get(cid)!.push(p);
    }

    const cancellation = await this.cancellationRepo.findOne({
      where: { booking: { id } },
      relations: { cancelledByUser: true },
    });

    // canPayRemainder: staff only, BOOKED + DEPOSIT_PAID + positive remainder
    const isStaff = currentUser.roles.some(
      (r) =>
        r === RoleTitle.RECEPTIONIST ||
        r === RoleTitle.ACCOUNTANT ||
        r === RoleTitle.MANAGER,
    );
    let canPayRemainder = false;
    if (
      isStaff &&
      booking.bookingStatus === BookingStatus.BOOKED &&
      booking.paymentStatus === PaymentStatus.DEPOSIT_PAID
    ) {
      const effectivePrice = await this.getEffectiveLessonPrice(
        booking.instructor.gender,
        booking.trainingType,
        booking.vehicleSource,
        booking.createdAt,
      );
      const totalPaid = paymentsWithCharge.reduce(
        (sum, p) => sum + parseFloat(p.amountPaid.toString()),
        0,
      );
      canPayRemainder = effectivePrice - totalPaid > 0;
    }

    const { date, dayName, startTime, endTime } = this.toLocalSlot(booking.startAt, booking.endAt);
    return {
      booking: {
        id: booking.id,
        bookingStatus: booking.bookingStatus,
        paymentStatus: booking.paymentStatus,
        trainingType: booking.trainingType,
        vehicleSource: booking.vehicleSource,
        date,
        dayName,
        startTime,
        endTime,
        lockedUntil: booking.lockedUntil,
        createdAt: booking.createdAt,
      },
      student: {
        id: booking.student.id,
        name: booking.student.user.name,
        phone: booking.student.user.phone,
        studentStatus: booking.student.studentStatus,
      },
      instructor: {
        id: booking.instructor.id,
        name: booking.instructor.user.name,
        gender: booking.instructor.gender,
        instructorType: booking.instructor.instructorType,
      },
      vehicle: booking.vehicle
        ? {
            id: booking.vehicle.id,
            plateNumber: booking.vehicle.plateNumber,
            model: booking.vehicle.model,
            type: booking.vehicle.type,
          }
        : null,
      charges: charges.map((c) => ({
        id: c.id,
        chargeReason: c.chargeReason,
        amountDue: c.amountDue,
        chargeStatus: c.chargeStatus,
        payments: (chargePaymentMap.get(c.id) ?? []).map((p) => ({
          id: p.id,
          amountPaid: p.amountPaid,
          paymentMethod: p.paymentMethod,
          receivedAt: p.receivedAt,
        })),
      })),
      cancellation: cancellation
        ? {
            cancellationParty: cancellation.cancellationParty,
            cancellationReason: cancellation.cancellationReason,
            cancelledAt: cancellation.cancelledAt,
            cancelledByUser: cancellation.cancelledByUser?.name ?? null,
          }
        : null,
      canPayRemainder,
    };
  }

  // ─── 3. AVAILABLE SLOTS ─────────────────────────────────────────────────────

  async getAvailableSlots(query: AvailableSlotsQueryDto) {
    const { trainingType, vehicleSource, instructorGender } = query;

    const durationMin = await this.getNumericSetting('lesson_duration_minutes', 90);
    const windowDays = await this.getNumericSetting('booking_window_days', 4);
    const durationMs = durationMin * 60 * 1000;

    const now = new Date();
    // localNow has UTC components === school local wall-clock time.
    // Used for comparisons against TIMESTAMP (no TZ) columns.
    const localNow = new Date(now.getTime() + SCHOOL_TZ_OFFSET_MS);
    const localWindowEnd = new Date(localNow.getTime() + windowDays * 24 * 60 * 60 * 1000);

    // A) Matching instructors with user info
    const matchingTypes =
      trainingType === TrainingType.MANUAL
        ? [InstructorType.MANUAL, InstructorType.BOTH]
        : [InstructorType.AUTOMATIC, InstructorType.BOTH];

    const instructors = await this.instructorRepo
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.user', 'u')
      .where('i.gender = :gender', { gender: instructorGender })
      .andWhere('i.instructorType IN (:...types)', { types: matchingTypes })
      .andWhere('u.accountStatus = :status', { status: 'ACTIVE' })
      .getMany();

    if (instructors.length === 0) return [];

    const instructorIds = instructors.map((i) => i.id);

    // B) Weekly availabilities — all at once, grouped by instructor
    const weeklyAvails = await this.weeklyAvailRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.instructor', 'i')
      .where('i.id IN (:...ids)', { ids: instructorIds })
      .getMany();

    const availByInstructorDay = new Map<string, InstructorWeeklyAvailability>();
    for (const a of weeklyAvails) {
      availByInstructorDay.set(`${a.instructor.id}:${a.dayOfWeek}`, a);
    }

    // D) Instructor unavailable periods in window — startAt/endAt are TIMESTAMP (local)
    const instrUnavails = await this.instrUnavailRepo
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.instructor', 'i')
      .where('i.id IN (:...ids)', { ids: instructorIds })
      .andWhere('p.startAt < :windowEnd', { windowEnd: localWindowEnd })
      .andWhere('p.endAt > :localNow', { localNow })
      .getMany();

    // E) Active bookings for these instructors in window
    // startAt/endAt are TIMESTAMP (local); lockedUntil is TIMESTAMPTZ (utcNow)
    const instrBookings = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.instructor', 'i')
      .where('i.id IN (:...ids)', { ids: instructorIds })
      .andWhere(
        `(b.bookingStatus = :booked OR (b.bookingStatus = :pending AND b.lockedUntil > :utcNow))`,
        { booked: BookingStatus.BOOKED, pending: BookingStatus.PENDING_PAYMENT, utcNow: now },
      )
      .andWhere('b.startAt < :windowEnd', { windowEnd: localWindowEnd })
      .andWhere('b.endAt > :localNow', { localNow })
      .getMany();

    // G) Vehicle data for SCHOOL_CAR
    let activeVehicles: Vehicle[] = [];
    let vehicleUnavails: VehicleUnavailablePeriod[] = [];
    let vehicleBookings: Booking[] = [];

    if (vehicleSource === VehicleSource.SCHOOL_CAR) {
      const vehicleType =
        trainingType === TrainingType.MANUAL ? VehicleType.MANUAL : VehicleType.AUTOMATIC;

      activeVehicles = await this.vehicleRepo.find({
        where: { type: vehicleType, status: VehicleStatus.ACTIVE },
      });

      if (activeVehicles.length > 0) {
        const vehicleIds = activeVehicles.map((v) => v.id);

        vehicleUnavails = await this.vehicleUnavailRepo
          .createQueryBuilder('vp')
          .innerJoinAndSelect('vp.vehicle', 'v')
          .where('v.id IN (:...ids)', { ids: vehicleIds })
          .andWhere('vp.startAt < :windowEnd', { windowEnd: localWindowEnd })
          .andWhere(`(vp.endAt IS NULL OR vp.endAt > :localNow)`, { localNow })
          .getMany();

        vehicleBookings = await this.bookingRepo
          .createQueryBuilder('b')
          .innerJoinAndSelect('b.vehicle', 'v')
          .where('v.id IN (:...ids)', { ids: vehicleIds })
          .andWhere(
            `(b.bookingStatus = :booked OR (b.bookingStatus = :pending AND b.lockedUntil > :utcNow))`,
            { booked: BookingStatus.BOOKED, pending: BookingStatus.PENDING_PAYMENT, utcNow: now },
          )
          .andWhere('b.startAt < :windowEnd', { windowEnd: localWindowEnd })
          .andWhere('b.endAt > :localNow', { localNow })
          .getMany();
      }
    }

    // ── Generate slots per instructor ──────────────────────────────────────────
    const result: {
      instructor: { id: number; name: string; gender: Gender };
      slots: { date: string; dayName: string; startTime: string; endTime: string }[];
    }[] = [];

    for (const instructor of instructors) {
      const myUnavails = instrUnavails.filter((p) => p.instructor.id === instructor.id);
      const myBookings = instrBookings.filter((b) => b.instructor.id === instructor.id);
      const freeSlots: { date: string; dayName: string; startTime: string; endTime: string }[] = [];

      for (let dayOffset = 0; dayOffset < windowDays; dayOffset++) {
        // Midnight of (today + dayOffset) in local wall-clock frame (UTC components = local values).
        const localUTCMidnight = new Date(Date.UTC(
          localNow.getUTCFullYear(),
          localNow.getUTCMonth(),
          localNow.getUTCDate() + dayOffset,
        ));

        const dayEnum = JS_DAY_MAP[localUTCMidnight.getUTCDay()];
        const avail = availByInstructorDay.get(`${instructor.id}:${dayEnum}`);
        if (!avail) continue;

        // Slot boundaries in local wall-clock frame — no offset subtraction needed.
        const [sh, sm] = avail.startTime.split(':').map(Number);
        const [eh, em] = avail.endTime.split(':').map(Number);

        const availStart = new Date(localUTCMidnight.getTime() + (sh * 60 + sm) * 60_000);
        const availEnd   = new Date(localUTCMidnight.getTime() + (eh * 60 + em) * 60_000);

        let slotStart = new Date(availStart);

        while (slotStart.getTime() + durationMs <= availEnd.getTime()) {
          const slotEnd = new Date(slotStart.getTime() + durationMs);

          // Skip past slots (compare against local now)
          if (slotStart <= localNow) {
            slotStart = slotEnd;
            continue;
          }

          // D) Drop if instructor unavailable period overlaps
          const instrBlocked = myUnavails.some((p) =>
            this.overlaps(slotStart, slotEnd, p.startAt, p.endAt),
          );
          if (instrBlocked) {
            slotStart = slotEnd;
            continue;
          }

          // E) Drop if instructor has a reserving booking that overlaps
          const instrBooked = myBookings.some((b) =>
            this.overlaps(slotStart, slotEnd, b.startAt, b.endAt),
          );
          if (instrBooked) {
            slotStart = slotEnd;
            continue;
          }

          // G) SCHOOL_CAR: drop if no vehicle is free
          if (vehicleSource === VehicleSource.SCHOOL_CAR) {
            const hasVehicle = activeVehicles.some((v) => {
              const vUnavail = vehicleUnavails.some(
                (vp) =>
                  vp.vehicle.id === v.id &&
                  this.overlaps(slotStart, slotEnd, vp.startAt, vp.endAt),
              );
              if (vUnavail) return false;

              const vBooked = vehicleBookings.some(
                (b) =>
                  b.vehicle?.id === v.id &&
                  this.overlaps(slotStart, slotEnd, b.startAt, b.endAt),
              );
              return !vBooked;
            });

            if (!hasVehicle) {
              slotStart = slotEnd;
              continue;
            }
          }

          freeSlots.push(this.toLocalSlot(slotStart, slotEnd));
          slotStart = slotEnd;
        }
      }

      if (freeSlots.length > 0) {
        result.push({
          instructor: {
            id: instructor.id,
            name: instructor.user.name,
            gender: instructor.gender,
          },
          slots: freeSlots,
        });
      }
    }

    return result;
  }

  // ─── 4. CREATE BOOKING FROM DASHBOARD (Web / CASH) ──────────────────────────

  async createReceptionBooking(
    dto: CreateReceptionBookingDto,
    currentUser: AuthenticatedUser,
  ) {
    // Parse local wall-clock date+time directly — no timezone offset needed.
    // Date.UTC ensures the result is independent of Node.js process timezone.
    const [year, month, day] = dto.date.split('-').map(Number);
    const [hour, minute] = dto.time.split(':').map(Number);
    const startAt = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

    const durationMin = await this.getNumericSetting('lesson_duration_minutes', 90);
    const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);

    // Fetch vehicle candidates outside the transaction (no pessimistic lock).
    // The btree_gist EXCLUDE constraint is the real atomicity guard; if a vehicle
    // gets claimed between this check and the INSERT, we catch 23P01 and retry.
    const candidates: Array<Vehicle | null> =
      dto.vehicleSource === VehicleSource.SCHOOL_CAR
        ? await this.getVehicleCandidates(dto.trainingType, startAt, endAt)
        : [null];

    if (dto.vehicleSource === VehicleSource.SCHOOL_CAR && candidates.length === 0) {
      throw new ConflictException('No available vehicle for this time slot');
    }

    for (const vehicle of candidates) {
      try {
        return await this.dataSource.transaction(async (em) => {
          const now = new Date();

          const student = await em.findOne(Student, {
            where: { id: dto.studentId },
            relations: { user: true },
          });
          if (!student) throw new NotFoundException('Student not found');

          const instructor = await em.findOne(Instructor, {
            where: { id: dto.instructorId },
            relations: { user: true },
            lock: { mode: 'pessimistic_write' },
          });
          if (!instructor) throw new NotFoundException('Instructor not found');

          const slotOk = await this.validateSlotInTx(
            em, instructor.id, startAt, endAt, dto.trainingType, dto.vehicleSource,
          );
          if (!slotOk) throw new ConflictException('The selected time slot is not available');

          const pendingExists = await em
            .createQueryBuilder(Booking, 'b')
            .innerJoin('b.student', 's')
            .where('s.id = :sid', { sid: student.id })
            .andWhere('b.bookingStatus = :status', { status: BookingStatus.PENDING_PAYMENT })
            .andWhere('b.lockedUntil > :now', { now })
            .getCount();
          if (pendingExists > 0) {
            throw new BadRequestException('Student already has an active pending booking');
          }

          const creditBooking = await em
            .createQueryBuilder(Booking, 'b')
            .innerJoin('b.student', 's')
            .where('s.id = :sid', { sid: student.id })
            .andWhere('b.bookingStatus = :status', { status: BookingStatus.CANCELLED })
            .andWhere('b.paymentStatus = :pstatus', {
              pstatus: PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING,
            })
            .orderBy('b.createdAt', 'DESC')
            .getOne();

          if (creditBooking) {
            if (dto.collectedAmount !== undefined && dto.collectedAmount !== null) {
              throw new BadRequestException(
                'Student has available rebooking credit — omit collectedAmount',
              );
            }
            return this.createRebookingCreditBranch(
              em, creditBooking, student, instructor, vehicle, dto, startAt, endAt, now,
            );
          }

          return this.createNormalCashBranch(
            em, student, instructor, vehicle, dto, startAt, endAt, now,
          );
        });
      } catch (err: any) {
        if (err?.code === '23P01') {
          if (err?.constraint === 'ex_booking_vehicle_overlap') continue;
          throw new ConflictException('Booking conflicts with an existing reservation');
        }
        throw err;
      }
    }

    throw new ConflictException('No available vehicle for this time slot');
  }

  private async createRebookingCreditBranch(
    em: EntityManager,
    creditBooking: Booking,
    student: Student,
    instructor: Instructor,
    vehicle: Vehicle | null,
    dto: CreateReceptionBookingDto,
    startAt: Date,
    endAt: Date,
    now: Date,
  ) {
    // Create new booking: BOOKED + DEPOSIT_PAID immediately
    const newBooking = await em.save(Booking, {
      vehicleSource: dto.vehicleSource,
      bookingStatus: BookingStatus.BOOKED,
      paymentStatus: PaymentStatus.DEPOSIT_PAID,
      trainingType: dto.trainingType,
      startAt,
      endAt,
      lockedUntil: null,
      student,
      instructor,
      vehicle,
      replacedBooking: creditBooking,
    } as Booking);

    // Mark old booking deposit as used
    await em.update(Booking, { id: creditBooking.id }, {
      paymentStatus: PaymentStatus.DEPOSIT_USED_IN_REBOOKING,
    });

    // Re-point existing LESSON_DEPOSIT charge to the new booking
    await em
      .createQueryBuilder()
      .update(StudentCharge)
      .set({ booking: newBooking })
      .where('booking_id = :bid', { bid: creditBooking.id })
      .andWhere('charge_reason = :reason', { reason: ChargeReason.LESSON_DEPOSIT })
      .execute();

    await this.notificationsService.sendAsync({
      recipientUser: student.user,
      title: 'تأكيد الحجز',
      body: 'تم تأكيد حجزك للدرس بنجاح باستخدام العربون المتاح.',
      notificationType: NotificationType.BOOKING_CONFIRMED,
    });

    return { booking: newBooking };
  }

  private async createNormalCashBranch(
    em: EntityManager,
    student: Student,
    instructor: Instructor,
    vehicle: Vehicle | null,
    dto: CreateReceptionBookingDto,
    startAt: Date,
    endAt: Date,
    now: Date,
  ) {
    if (dto.collectedAmount === undefined || dto.collectedAmount === null) {
      throw new BadRequestException('collectedAmount is required for cash bookings');
    }

    const effectivePrice = await this.getEffectiveLessonPrice(
      instructor.gender,
      dto.trainingType,
      dto.vehicleSource,
      now,
    );
    const depositPct = await this.getNumericSetting('deposit_percentage', 50);
    const depositAmount = Math.round((effectivePrice * depositPct) / 100 * 100) / 100;

    if (dto.collectedAmount < depositAmount) {
      throw new BadRequestException(
        `Collected amount (${dto.collectedAmount}) is less than the required deposit (${depositAmount})`,
      );
    }

    // Create booking: BOOKED + DEPOSIT_PAID directly (web/reception = CASH, no hold period)
    const booking = await em.save(Booking, {
      vehicleSource: dto.vehicleSource,
      bookingStatus: BookingStatus.BOOKED,
      paymentStatus: PaymentStatus.DEPOSIT_PAID,
      trainingType: dto.trainingType,
      startAt,
      endAt,
      lockedUntil: null,
      student,
      instructor,
      vehicle,
      replacedBooking: null,
    } as Booking);

    // Create LESSON_DEPOSIT charge
    const charge = await em.save(StudentCharge, {
      chargeReason: ChargeReason.LESSON_DEPOSIT,
      amountDue: depositAmount.toFixed(2),
      chargeStatus: ChargeStatus.UNPAID,
      student,
      booking,
      certificate: null,
      certificateExamResult: null,
      dueAt: null,
    } as StudentCharge);

    // Record the actual collected amount (overpayment allowed)
    await em.save(StudentPayment, {
      amountPaid: dto.collectedAmount.toFixed(2),
      paymentMethod: PaymentMethod.CASH,
      receivedAt: now,
      studentCharge: charge,
    } as StudentPayment);

    // Recalc charge status
    const chargeStatus = this.calcChargeStatus(depositAmount, dto.collectedAmount);
    await em.update(StudentCharge, { id: charge.id }, { chargeStatus });

    await this.notificationsService.sendAsync({
      recipientUser: student.user,
      title: 'تأكيد الحجز',
      body: 'تم تأكيد حجزك للدرس وتسجيل العربون بنجاح.',
      notificationType: NotificationType.BOOKING_CONFIRMED,
    });

    return { booking };
  }

  // ─── 5. PAY REMAINDER (= COMPLETE LESSON) ───────────────────────────────────

  async payRemainder(bookingId: number) {
    return await this.dataSource.transaction(async (em) => {
      const booking = await em.findOne(Booking, {
        where: { id: bookingId },
        relations: { student: { user: true }, instructor: true },
        lock: { mode: 'pessimistic_write' },
      });

      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.bookingStatus !== BookingStatus.BOOKED) {
        throw new BadRequestException('Booking must be in BOOKED status to pay remainder');
      }
      if (booking.paymentStatus !== PaymentStatus.DEPOSIT_PAID) {
        throw new BadRequestException('Booking must be in DEPOSIT_PAID status to pay remainder');
      }

      const now = new Date();

      // 1) Effective lesson price as of booking.createdAt (snapshot, not today's price)
      const effectivePrice = await this.getEffectiveLessonPrice(
        booking.instructor.gender,
        booking.trainingType,
        booking.vehicleSource,
        booking.createdAt,
      );

      // 2) Sum all existing payments on this booking's charges
      const charges = await em.find(StudentCharge, {
        where: { booking: { id: bookingId } },
      });
      const chargeIds = charges.map((c) => c.id);
      const existingPayments =
        chargeIds.length > 0
          ? await em.find(StudentPayment, {
              where: { studentCharge: { id: In(chargeIds) } },
            })
          : [];
      const totalPaid = existingPayments.reduce(
        (sum, p) => sum + parseFloat(p.amountPaid.toString()),
        0,
      );
      const remainder = Math.round((effectivePrice - totalPaid) * 100) / 100;

      if (remainder <= 0) {
        throw new BadRequestException('No remainder to pay — lesson is already fully paid');
      }

      // 3) Create LESSON_REMAINDER charge
      const remainderCharge = await em.save(StudentCharge, {
        chargeReason: ChargeReason.LESSON_REMAINDER,
        amountDue: remainder.toFixed(2),
        chargeStatus: ChargeStatus.UNPAID,
        student: booking.student,
        booking,
        certificate: null,
        certificateExamResult: null,
        dueAt: null,
      } as StudentCharge);

      // 4) Create CASH payment for the full remainder
      await em.save(StudentPayment, {
        amountPaid: remainder.toFixed(2),
        paymentMethod: PaymentMethod.CASH,
        receivedAt: now,
        studentCharge: remainderCharge,
      } as StudentPayment);

      // 5) Recalc charge status → always PAID since amount_paid === amount_due
      await em.update(StudentCharge, { id: remainderCharge.id }, {
        chargeStatus: ChargeStatus.PAID,
      });

      // 6+7) Mark booking FULLY_PAID and COMPLETED atomically
      await em.update(Booking, { id: bookingId }, {
        paymentStatus: PaymentStatus.FULLY_PAID,
        bookingStatus: BookingStatus.COMPLETED,
      });

      // 8) Instructor payout — idempotent (UNIQUE(booking_id) guards double-creation)
      const existingPayout = await em.findOne(ExpenseInstructor, {
        where: { booking: { id: bookingId } },
      });

      if (!existingPayout) {
        const instrPrice = await this.getEffectiveInstructorPrice(
          booking.instructor.gender,
          booking.createdAt,
        );
        const expense = await em.save(Expense, {
          category: ExpenseCategory.INSTRUCTOR,
          amount: instrPrice.toFixed(2),
          expenseDate: new Date(now.getTime() + SCHOOL_TZ_OFFSET_MS).toISOString().split('T')[0],
          status: ExpenseStatus.PAID,
          note: null,
          employee: null,
        } as Expense);

        await em.save(ExpenseInstructor, {
          booking,
          expense,
        } as ExpenseInstructor);
      }

      return { message: 'Lesson completed and payment recorded', bookingId };
    });
  }

  // ─── 6. CANCEL BOOKING ──────────────────────────────────────────────────────

  async cancelBooking(
    bookingId: number,
    dto: CancelBookingDto,
    currentUser: AuthenticatedUser,
  ) {
    // Capture student user outside the transaction so we can notify after commit.
    let studentUser!: User;

    await this.dataSource.transaction(async (em) => {
      const booking = await em.findOne(Booking, {
        where: { id: bookingId },
        relations: { student: { user: true } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!booking) throw new NotFoundException('Booking not found');

      const cancellable = [BookingStatus.BOOKED, BookingStatus.PENDING_PAYMENT];
      if (!cancellable.includes(booking.bookingStatus)) {
        throw new BadRequestException(
          `Cannot cancel a booking with status '${booking.bookingStatus}'`,
        );
      }

      // Deposit policy per cancellation party
      const depositStatus =
        dto.cancellationParty === CancellationParty.STUDENT
          ? PaymentStatus.DEPOSIT_NON_REFUNDABLE
          : PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING;

      await em.update(Booking, { id: bookingId }, {
        bookingStatus: BookingStatus.CANCELLED,
        paymentStatus: depositStatus,
      });

      const cancellingUser = await em.findOne(User, {
        where: { id: currentUser.userId },
      });

      await em.save(BookingCancellation, {
        cancellationParty: dto.cancellationParty,
        cancellationReason: dto.cancellationReason,
        cancelledAt: new Date(),
        booking: { id: bookingId } as Booking,
        cancelledByUser: cancellingUser,
      } as BookingCancellation);

      // Save student user reference — notification fires AFTER commit.
      studentUser = booking.student.user;
    });

    // Notification sent only after the transaction successfully commits.
    // This prevents the student from receiving a cancellation notice
    // if the transaction rolls back.
    await this.notificationsService.sendAsync({
      recipientUser: studentUser,
      title: 'تم إلغاء الحجز',
      body: `تم إلغاء درسك. السبب: ${dto.cancellationReason}. يرجى حجز موعد بديل.`,
      notificationType: NotificationType.BOOKING_CANCELLED,
    });

    return { message: 'Booking cancelled successfully', bookingId };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /** Re-validates a slot inside an open transaction. */
  private async validateSlotInTx(
    em: EntityManager,
    instructorId: number,
    startAt: Date,
    endAt: Date,
    trainingType: TrainingType,
    vehicleSource: VehicleSource,
  ): Promise<boolean> {
    // startAt is local wall-clock (TIMESTAMP); getUTC* returns local values directly.
    const dayEnum = JS_DAY_MAP[startAt.getUTCDay()];

    const avail = await em.findOne(InstructorWeeklyAvailability, {
      where: { instructor: { id: instructorId }, dayOfWeek: dayEnum },
    });
    if (!avail) return false;

    const [sh, sm] = avail.startTime.split(':').map(Number);
    const [eh, em2] = avail.endTime.split(':').map(Number);
    const localUTCMidnight = new Date(Date.UTC(
      startAt.getUTCFullYear(),
      startAt.getUTCMonth(),
      startAt.getUTCDate(),
    ));
    const availStart = new Date(localUTCMidnight.getTime() + (sh * 60 + sm) * 60_000);
    const availEnd   = new Date(localUTCMidnight.getTime() + (eh * 60 + em2) * 60_000);

    if (startAt < availStart || endAt > availEnd) return false;

    // D) Instructor unavailable periods — startAt/endAt are TIMESTAMP (local frame)
    const instrUnavail = await em
      .createQueryBuilder(InstructorUnavailablePeriod, 'p')
      .innerJoin('p.instructor', 'i')
      .where('i.id = :id', { id: instructorId })
      .andWhere('p.startAt < :endAt', { endAt })
      .andWhere('p.endAt > :startAt', { startAt })
      .getCount();
    if (instrUnavail > 0) return false;

    // E) Active bookings — startAt/endAt are TIMESTAMP; lockedUntil is TIMESTAMPTZ
    const instrConflict = await em
      .createQueryBuilder(Booking, 'b')
      .innerJoin('b.instructor', 'i')
      .where('i.id = :id', { id: instructorId })
      .andWhere(
        `(b.bookingStatus = :booked OR (b.bookingStatus = :pending AND b.lockedUntil > :utcNow))`,
        { booked: BookingStatus.BOOKED, pending: BookingStatus.PENDING_PAYMENT, utcNow: new Date() },
      )
      .andWhere('b.startAt < :endAt', { endAt })
      .andWhere('b.endAt > :startAt', { startAt })
      .getCount();
    if (instrConflict > 0) return false;

    return true;
  }

  /** Returns vehicles of the right type that appear free for [startAt, endAt).
   *  No lock is taken — the btree_gist EXCLUDE constraint is the real guard.
   *  If a candidate is claimed between this read and the INSERT, the caller
   *  catches 23P01 on ex_booking_vehicle_overlap and retries with the next one. */
  private async getVehicleCandidates(
    trainingType: TrainingType,
    startAt: Date,
    endAt: Date,
  ): Promise<Vehicle[]> {
    const vehicleType =
      trainingType === TrainingType.MANUAL ? VehicleType.MANUAL : VehicleType.AUTOMATIC;

    // Blocked by active bookings (start_at/end_at are TIMESTAMP; locked_until is TIMESTAMPTZ)
    const bookedRows: { vehicle_id: string }[] = await this.dataSource.query(
      `SELECT DISTINCT vehicle_id
       FROM booking
       WHERE vehicle_id IS NOT NULL
         AND (booking_status = 'BOOKED'
              OR (booking_status = 'PENDING_PAYMENT' AND locked_until > $1))
         AND start_at < $2
         AND end_at > $3`,
      [new Date(), endAt, startAt],
    );

    // Blocked by unavailable periods (start_at/end_at are TIMESTAMP)
    const unavailRows: { vehicle_id: string }[] = await this.dataSource.query(
      `SELECT DISTINCT vehicle_id
       FROM vehicle_unavailable_periods
       WHERE start_at < $1
         AND (end_at IS NULL OR end_at > $2)`,
      [endAt, startAt],
    );

    const blockedIds = new Set<number>([
      ...bookedRows.map((r) => Number(r.vehicle_id)),
      ...unavailRows.map((r) => Number(r.vehicle_id)),
    ]);

    const vehicles = await this.vehicleRepo.find({
      where: { type: vehicleType, status: VehicleStatus.ACTIVE },
    });

    return vehicles.filter((v) => !blockedIds.has(v.id));
  }
}
