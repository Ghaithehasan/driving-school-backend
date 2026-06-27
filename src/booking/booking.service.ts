import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  AccountStatus,
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
import { ShamcashTransaction } from '../payments/shamcash-transaction.entity';
import { ShamcashService } from '../payments/shamcash/shamcash.service';
import { Expense } from '../expenses/expense.entity';
import { ExpenseInstructor } from '../expenses/expense-instructor.entity';
import { InstructorPrice } from '../expenses/instructor-price.entity';
import { Setting } from '../settings/setting.entity';
import { User } from '../users/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AvailableSlotsQueryDto } from './dto/available-slots-query.dto';
import { CreateReceptionBookingDto } from './dto/create-reception-booking.dto';
import { CreateStudentBookingDto } from './dto/create-student-booking.dto';
import { ConfirmBookingPaymentDto } from './dto/confirm-booking-payment.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { StudentCancelBookingDto } from './dto/student-cancel-booking.dto';

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
    @InjectRepository(ShamcashTransaction)
    private readonly shamcashTxnRepo: Repository<ShamcashTransaction>,
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
    private readonly shamcashService: ShamcashService,
  ) {}

  // ─── Private Utilities ──────────────────────────────────────────────────────

  private async getNumericSetting(
    key: string,
    fallback: number,
  ): Promise<number> {
    const s = await this.settingRepo.findOne({ where: { key } });
    if (!s) return fallback;
    return parseFloat(s.value);
  }

  private async getStringSetting(
    key: string,
    fallback: string | null = null,
  ): Promise<string | null> {
    const s = await this.settingRepo.findOne({ where: { key } });
    return s?.value ?? fallback;
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

    if (!lp)
      throw new BadRequestException(
        'Lesson price not configured for this combination',
      );
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
      date: start.toISOString().slice(0, 10),
      dayName: ARABIC_DAY_NAMES[start.getUTCDay()],
      startTime: `${pad(start.getUTCHours())}:${pad(start.getUTCMinutes())}`,
      endTime: `${pad(end.getUTCHours())}:${pad(end.getUTCMinutes())}`,
    };
  }

  private async parseLessonSlot(date: string, time: string) {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    const startAt = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    const durationMin = await this.getNumericSetting(
      'lesson_duration_minutes',
      90,
    );
    const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);

    return { startAt, endAt };
  }

  private truncateNullable(value: string | null, maxLength: number) {
    return value ? value.slice(0, maxLength) : null;
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
      .andWhere('b.bookingStatus = :status', {
        status: BookingStatus.CANCELLED,
      })
      .andWhere('b.paymentStatus = :ps', {
        ps: PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING,
      })
      .orderBy('b.createdAt', 'DESC')
      .getOne();

    if (!credit) return { hasCredit: false };

    // Sum what was actually paid on the lesson charge of the cancelled booking.
    const charge = await this.chargeRepo.findOne({
      where: { booking: { id: credit.id }, chargeReason: ChargeReason.LESSON },
    });
    const payments = charge
      ? await this.paymentRepo.find({
          where: { studentCharge: { id: charge.id } },
        })
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
      qb.andWhere('(su.name ILIKE :search OR iu.name ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('b.startAt', 'DESC').skip(skip).take(limit);

    const [bookings, total] = await qb.getManyAndCount();

    return this.shapeBookingList(bookings, total, page, limit);
  }

  async listMyBookings(userId: number, query: ListBookingsQueryDto) {
    await this.resolveStudentByUserId(userId);

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
      .leftJoinAndSelect('b.vehicle', 'v')
      .where('su.id = :userId', { userId });

    if (bookingStatus) {
      qb.andWhere('b.bookingStatus = :bookingStatus', { bookingStatus });
    }

    if (search) {
      qb.andWhere('iu.name ILIKE :search', { search: `%${search}%` });
    }

    qb.orderBy('b.startAt', 'DESC').skip(skip).take(limit);

    const [bookings, total] = await qb.getManyAndCount();

    return this.shapeBookingList(bookings, total, page, limit);
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

    return this.assembleBookingDetail(booking, this.isStaffUser(currentUser));
  }

  async getMyBookingDetail(userId: number, bookingId: number) {
    await this.resolveStudentByUserId(userId);

    const booking = await this.bookingRepo
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.student', 's')
      .innerJoinAndSelect('s.user', 'su')
      .innerJoinAndSelect('b.instructor', 'i')
      .innerJoinAndSelect('i.user', 'iu')
      .leftJoinAndSelect('b.vehicle', 'v')
      .where('b.id = :bookingId', { bookingId })
      .andWhere('su.id = :userId', { userId })
      .getOne();

    if (!booking) throw new NotFoundException('Booking not found');

    return this.assembleBookingDetail(booking, false);
  }

  // ─── 3. AVAILABLE SLOTS ─────────────────────────────────────────────────────

  async getAvailableSlots(query: AvailableSlotsQueryDto) {
    const { trainingType, vehicleSource, instructorGender } = query;

    const durationMin = await this.getNumericSetting(
      'lesson_duration_minutes',
      90,
    );
    const windowDays = await this.getNumericSetting('booking_window_days', 4);
    const durationMs = durationMin * 60 * 1000;

    const now = new Date();
    // localNow has UTC components === school local wall-clock time.
    // Used for comparisons against TIMESTAMP (no TZ) columns.
    const localNow = new Date(now.getTime() + SCHOOL_TZ_OFFSET_MS);
    const localWindowEnd = new Date(
      localNow.getTime() + windowDays * 24 * 60 * 60 * 1000,
    );

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
      .andWhere('u.accountStatus = :status', { status: AccountStatus.ACTIVE })
      .getMany();

    if (instructors.length === 0) return [];

    const instructorIds = instructors.map((i) => i.id);

    // B) Weekly availabilities — all at once, grouped by instructor
    const weeklyAvails = await this.weeklyAvailRepo
      .createQueryBuilder('a')
      .innerJoinAndSelect('a.instructor', 'i')
      .where('i.id IN (:...ids)', { ids: instructorIds })
      .getMany();

    const availByInstructorDay = new Map<
      string,
      InstructorWeeklyAvailability
    >();
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
        {
          booked: BookingStatus.BOOKED,
          pending: BookingStatus.PENDING_PAYMENT,
          utcNow: now,
        },
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
        trainingType === TrainingType.MANUAL
          ? VehicleType.MANUAL
          : VehicleType.AUTOMATIC;

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
            {
              booked: BookingStatus.BOOKED,
              pending: BookingStatus.PENDING_PAYMENT,
              utcNow: now,
            },
          )
          .andWhere('b.startAt < :windowEnd', { windowEnd: localWindowEnd })
          .andWhere('b.endAt > :localNow', { localNow })
          .getMany();
      }
    }

    // ── Generate slots per instructor ──────────────────────────────────────────
    const result: {
      instructor: { id: number; name: string; gender: Gender };
      slots: {
        date: string;
        dayName: string;
        startTime: string;
        endTime: string;
      }[];
    }[] = [];

    for (const instructor of instructors) {
      const myUnavails = instrUnavails.filter(
        (p) => p.instructor.id === instructor.id,
      );
      const myBookings = instrBookings.filter(
        (b) => b.instructor.id === instructor.id,
      );
      const freeSlots: {
        date: string;
        dayName: string;
        startTime: string;
        endTime: string;
      }[] = [];

      for (let dayOffset = 0; dayOffset < windowDays; dayOffset++) {
        // Midnight of (today + dayOffset) in local wall-clock frame (UTC components = local values).
        const localUTCMidnight = new Date(
          Date.UTC(
            localNow.getUTCFullYear(),
            localNow.getUTCMonth(),
            localNow.getUTCDate() + dayOffset,
          ),
        );

        const dayEnum = JS_DAY_MAP[localUTCMidnight.getUTCDay()];
        const avail = availByInstructorDay.get(`${instructor.id}:${dayEnum}`);
        if (!avail) continue;

        // Slot boundaries in local wall-clock frame — no offset subtraction needed.
        const [sh, sm] = avail.startTime.split(':').map(Number);
        const [eh, em] = avail.endTime.split(':').map(Number);

        const availStart = new Date(
          localUTCMidnight.getTime() + (sh * 60 + sm) * 60_000,
        );
        const availEnd = new Date(
          localUTCMidnight.getTime() + (eh * 60 + em) * 60_000,
        );

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

    const durationMin = await this.getNumericSetting(
      'lesson_duration_minutes',
      90,
    );
    const endAt = new Date(startAt.getTime() + durationMin * 60 * 1000);

    // Fetch vehicle candidates outside the transaction (no pessimistic lock).
    // The btree_gist EXCLUDE constraint is the real atomicity guard; if a vehicle
    // gets claimed between this check and the INSERT, we catch 23P01 and retry.
    const candidates: Array<Vehicle | null> =
      dto.vehicleSource === VehicleSource.SCHOOL_CAR
        ? await this.getVehicleCandidates(dto.trainingType, startAt, endAt)
        : [null];

    if (
      dto.vehicleSource === VehicleSource.SCHOOL_CAR &&
      candidates.length === 0
    ) {
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
            em,
            instructor.id,
            startAt,
            endAt,
            dto.trainingType,
            dto.vehicleSource,
          );
          if (!slotOk)
            throw new ConflictException(
              'The selected time slot is not available',
            );

          const pendingExists = await em
            .createQueryBuilder(Booking, 'b')
            .innerJoin('b.student', 's')
            .where('s.id = :sid', { sid: student.id })
            .andWhere('b.bookingStatus = :status', {
              status: BookingStatus.PENDING_PAYMENT,
            })
            .andWhere('b.lockedUntil > :now', { now })
            .getCount();
          if (pendingExists > 0) {
            throw new BadRequestException(
              'Student already has an active pending booking',
            );
          }

          const creditBooking = await em
            .createQueryBuilder(Booking, 'b')
            .innerJoin('b.student', 's')
            .where('s.id = :sid', { sid: student.id })
            .andWhere('b.bookingStatus = :status', {
              status: BookingStatus.CANCELLED,
            })
            .andWhere('b.paymentStatus = :pstatus', {
              pstatus: PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING,
            })
            .orderBy('b.createdAt', 'DESC')
            .getOne();

          if (creditBooking) {
            if (
              dto.collectedAmount !== undefined &&
              dto.collectedAmount !== null
            ) {
              throw new BadRequestException(
                'Student has available rebooking credit — omit collectedAmount',
              );
            }
            return this.createRebookingCreditBranch(
              em,
              creditBooking,
              student,
              instructor,
              vehicle,
              dto,
              startAt,
              endAt,
              now,
            );
          }

          return this.createNormalCashBranch(
            em,
            student,
            instructor,
            vehicle,
            dto,
            startAt,
            endAt,
            now,
          );
        });
      } catch (err: any) {
        if (err?.code === '23P01') {
          if (err?.constraint === 'ex_booking_vehicle_overlap') continue;
          throw new ConflictException(
            'Booking conflicts with an existing reservation',
          );
        }
        throw err;
      }
    }

    throw new ConflictException('No available vehicle for this time slot');
  }

  async createStudentBooking(userId: number, dto: CreateStudentBookingDto) {
    const { startAt, endAt } = await this.parseLessonSlot(dto.date, dto.time);

    const candidates: Array<Vehicle | null> =
      dto.vehicleSource === VehicleSource.SCHOOL_CAR
        ? await this.getVehicleCandidates(dto.trainingType, startAt, endAt)
        : [null];

    if (
      dto.vehicleSource === VehicleSource.SCHOOL_CAR &&
      candidates.length === 0
    ) {
      throw new ConflictException('No available vehicle for this time slot');
    }

    for (const vehicle of candidates) {
      try {
        return await this.dataSource.transaction(async (em) => {
          const now = new Date();

          const student = await em.findOne(Student, {
            where: { user: { id: userId } },
            relations: { user: true },
          });
          if (!student) {
            throw new ForbiddenException('No student profile for this account');
          }

          const pendingExists = await em
            .createQueryBuilder(Booking, 'b')
            .innerJoin('b.student', 's')
            .where('s.id = :sid', { sid: student.id })
            .andWhere('b.bookingStatus = :status', {
              status: BookingStatus.PENDING_PAYMENT,
            })
            .andWhere('b.lockedUntil > :now', { now })
            .getCount();
          if (pendingExists > 0) {
            throw new BadRequestException(
              'Student already has an active pending booking',
            );
          }

          const instructor = await em.findOne(Instructor, {
            where: { id: dto.instructorId },
            relations: { user: true },
            lock: { mode: 'pessimistic_write' },
          });
          if (!instructor) throw new NotFoundException('Instructor not found');

          const slotOk = await this.validateSlotInTx(
            em,
            instructor.id,
            startAt,
            endAt,
            dto.trainingType,
            dto.vehicleSource,
          );
          if (!slotOk) {
            throw new ConflictException(
              'The selected time slot is not available',
            );
          }

          const creditBooking = await em
            .createQueryBuilder(Booking, 'b')
            .innerJoin('b.student', 's')
            .where('s.id = :sid', { sid: student.id })
            .andWhere('b.bookingStatus = :status', {
              status: BookingStatus.CANCELLED,
            })
            .andWhere('b.paymentStatus = :pstatus', {
              pstatus: PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING,
            })
            .orderBy('b.createdAt', 'DESC')
            .getOne();

          if (creditBooking) {
            const result = await this.createRebookingCreditBranch(
              em,
              creditBooking,
              student,
              instructor,
              vehicle,
              dto,
              startAt,
              endAt,
              now,
            );

            return { ...result, paymentRequired: false };
          }

          const effectivePrice = await this.getEffectiveLessonPrice(
            instructor.gender,
            dto.trainingType,
            dto.vehicleSource,
            now,
          );
          const depositPct = await this.getNumericSetting(
            'deposit_percentage',
            50,
          );
          const depositAmount =
            Math.round(((effectivePrice * depositPct) / 100) * 100) / 100;
          const holdMinutes = await this.getNumericSetting(
            'booking_hold_minutes',
            15,
          );
          const lockedUntil = new Date(now.getTime() + holdMinutes * 60 * 1000);

          const booking = await em.save(Booking, {
            vehicleSource: dto.vehicleSource,
            bookingStatus: BookingStatus.PENDING_PAYMENT,
            paymentStatus: PaymentStatus.PENDING_DEPOSIT,
            trainingType: dto.trainingType,
            startAt,
            endAt,
            lockedUntil,
            student,
            instructor,
            vehicle,
            replacedBooking: null,
          } as Booking);

          await em.save(StudentCharge, {
            chargeReason: ChargeReason.LESSON,
            amountDue: effectivePrice.toFixed(2),
            chargeStatus: ChargeStatus.UNPAID,
            student,
            booking,
            certificate: null,
            certificateExamResult: null,
            dueAt: null,
          } as StudentCharge);

          const receiverName = await this.getStringSetting(
            'shamcash_receiver_name',
          );

          return {
            booking,
            paymentRequired: true,
            depositAmount: depositAmount.toFixed(2),
            lockedUntil,
            receiverName,
          };
        });
      } catch (err: any) {
        if (err?.code === '23P01') {
          if (err?.constraint === 'ex_booking_vehicle_overlap') continue;
          throw new ConflictException(
            'Booking conflicts with an existing reservation',
          );
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
    dto: Pick<CreateReceptionBookingDto, 'vehicleSource' | 'trainingType'>,
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
    await em.update(
      Booking,
      { id: creditBooking.id },
      {
        paymentStatus: PaymentStatus.DEPOSIT_USED_IN_REBOOKING,
      },
    );

    // Re-point existing LESSON charge to the new booking.
    await em
      .createQueryBuilder()
      .update(StudentCharge)
      .set({ booking: newBooking })
      .where('booking_id = :bid', { bid: creditBooking.id })
      .andWhere('charge_reason = :reason', { reason: ChargeReason.LESSON })
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
      throw new BadRequestException(
        'collectedAmount is required for cash bookings',
      );
    }

    const effectivePrice = await this.getEffectiveLessonPrice(
      instructor.gender,
      dto.trainingType,
      dto.vehicleSource,
      now,
    );
    const depositPct = await this.getNumericSetting('deposit_percentage', 50);
    const depositAmount =
      Math.round(((effectivePrice * depositPct) / 100) * 100) / 100;

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

    // Create the single lesson charge with the full lesson price snapshot.
    const charge = await em.save(StudentCharge, {
      chargeReason: ChargeReason.LESSON,
      amountDue: effectivePrice.toFixed(2),
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

    // Recalc against the full lesson price. Deposit-only payments become PARTIALLY_PAID.
    const chargeStatus = this.calcChargeStatus(
      effectivePrice,
      dto.collectedAmount,
    );
    await em.update(StudentCharge, { id: charge.id }, { chargeStatus });

    await this.notificationsService.sendAsync({
      recipientUser: student.user,
      title: 'تأكيد الحجز',
      body: 'تم تأكيد حجزك للدرس وتسجيل العربون بنجاح.',
      notificationType: NotificationType.BOOKING_CONFIRMED,
    });

    return { booking };
  }

  async confirmStudentBookingPayment(
    userId: number,
    bookingId: number,
    dto: ConfirmBookingPaymentDto,
  ) {
    const now = new Date();
    const transactionId = String(dto.transactionId);

    const booking = await this.bookingRepo.findOne({
      where: { id: bookingId },
      relations: { student: { user: true } },
    });

    if (!booking) throw new NotFoundException('Booking not found');
    if (Number(booking.student.user.id) !== userId) {
      throw new NotFoundException('Booking not found');
    }
    if (
      booking.bookingStatus !== BookingStatus.PENDING_PAYMENT ||
      !booking.lockedUntil ||
      booking.lockedUntil <= now
    ) {
      throw new BadRequestException('Hold expired — please rebook');
    }

    const duplicate = await this.shamcashTxnRepo.findOne({
      where: { transactionId },
    });
    if (duplicate) {
      throw new BadRequestException('ShamCash transaction was already used');
    }

    const charge = await this.chargeRepo.findOne({
      where: { booking: { id: bookingId }, chargeReason: ChargeReason.LESSON },
    });
    if (!charge) {
      throw new BadRequestException('Lesson charge not found for this booking');
    }

    const fullPrice = parseFloat(charge.amountDue);
    const depositPct = await this.getNumericSetting('deposit_percentage', 50);
    const depositAmount =
      Math.round(((fullPrice * depositPct) / 100) * 100) / 100;
    const expectedReceiverName = (
      await this.getStringSetting('shamcash_receiver_name')
    )?.trim();

    if (!expectedReceiverName) {
      throw new BadRequestException('ShamCash receiver name is not configured');
    }

    const verified = await this.shamcashService.verifyTransaction(
      dto.transactionId,
    );

    if (!verified.verified) {
      throw new BadRequestException('ShamCash transaction was not found');
    }
    if (verified.amount < depositAmount) {
      throw new BadRequestException(
        `Paid amount (${verified.amount}) is less than the required deposit (${depositAmount})`,
      );
    }
    if (verified.receiverName?.trim() !== expectedReceiverName) {
      throw new BadRequestException('ShamCash payment receiver does not match');
    }

    let studentUser!: User;

    await this.dataSource.transaction(async (em) => {
      const lockedBooking = await em.findOne(Booking, {
        where: { id: bookingId },
        relations: { student: { user: true } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!lockedBooking) throw new NotFoundException('Booking not found');
      if (Number(lockedBooking.student.user.id) !== userId) {
        throw new NotFoundException('Booking not found');
      }
      if (
        lockedBooking.bookingStatus !== BookingStatus.PENDING_PAYMENT ||
        !lockedBooking.lockedUntil ||
        lockedBooking.lockedUntil <= new Date()
      ) {
        throw new BadRequestException('Hold expired — please rebook');
      }

      const txAlreadyUsed = await em.findOne(ShamcashTransaction, {
        where: { transactionId },
      });
      if (txAlreadyUsed) {
        throw new BadRequestException('ShamCash transaction was already used');
      }

      const lockedCharge = await em.findOne(StudentCharge, {
        where: {
          booking: { id: bookingId },
          chargeReason: ChargeReason.LESSON,
        },
      });
      if (!lockedCharge) {
        throw new BadRequestException(
          'Lesson charge not found for this booking',
        );
      }

      const existingPayments = await em.find(StudentPayment, {
        where: { studentCharge: { id: lockedCharge.id } },
      });
      const previousPaid = existingPayments.reduce(
        (sum, p) => sum + parseFloat(p.amountPaid.toString()),
        0,
      );

      const payment = await em.save(StudentPayment, {
        amountPaid: verified.amount.toFixed(2),
        paymentMethod: PaymentMethod.SHAM_CASH,
        receivedAt: verified.occurredAt ?? new Date(),
        studentCharge: lockedCharge,
      } as StudentPayment);

      await em.save(ShamcashTransaction, {
        transactionId,
        amount: verified.amount.toFixed(2),
        senderAccount: this.truncateNullable(verified.senderName, 50),
        receiverAccount: this.truncateNullable(verified.receiverName, 50),
        occurredAt: verified.occurredAt,
        verifiedAt: new Date(),
        rawPayload: verified.rawPayload,
        studentPayment: payment,
      } as ShamcashTransaction);

      const chargeStatus = this.calcChargeStatus(
        parseFloat(lockedCharge.amountDue),
        previousPaid + verified.amount,
      );
      await em.update(StudentCharge, { id: lockedCharge.id }, { chargeStatus });

      await em.update(
        Booking,
        { id: bookingId },
        {
          bookingStatus: BookingStatus.BOOKED,
          paymentStatus: PaymentStatus.DEPOSIT_PAID,
          lockedUntil: null,
        },
      );

      studentUser = lockedBooking.student.user;
    });

    await this.notificationsService.sendAsync({
      recipientUser: studentUser,
      title: 'تأكيد الحجز',
      body: 'تم تأكيد حجزك للدرس وتسجيل دفعة شام كاش بنجاح.',
      notificationType: NotificationType.BOOKING_CONFIRMED,
    });

    return {
      message: 'Booking payment confirmed successfully',
      bookingId,
      bookingStatus: BookingStatus.BOOKED,
      paymentStatus: PaymentStatus.DEPOSIT_PAID,
    };
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
        throw new BadRequestException(
          'Booking must be in BOOKED status to pay remainder',
        );
      }
      if (booking.paymentStatus !== PaymentStatus.DEPOSIT_PAID) {
        throw new BadRequestException(
          'Booking must be in DEPOSIT_PAID status to pay remainder',
        );
      }

      const now = new Date();

      // 1) Use the single lesson charge as the immutable price snapshot.
      const charge = await em.findOne(StudentCharge, {
        where: {
          booking: { id: bookingId },
          chargeReason: ChargeReason.LESSON,
        },
      });
      if (!charge) {
        throw new BadRequestException(
          'Lesson charge not found for this booking',
        );
      }

      // 2) Sum all existing payments on the same charge.
      const existingPayments = await em.find(StudentPayment, {
        where: { studentCharge: { id: charge.id } },
      });
      const totalPaid = existingPayments.reduce(
        (sum, p) => sum + parseFloat(p.amountPaid.toString()),
        0,
      );
      const remainder =
        Math.round((parseFloat(charge.amountDue) - totalPaid) * 100) / 100;

      if (remainder <= 0) {
        throw new BadRequestException(
          'No remainder to pay — lesson is already fully paid',
        );
      }

      // 3) Create CASH payment for the full remainder on the existing charge.
      await em.save(StudentPayment, {
        amountPaid: remainder.toFixed(2),
        paymentMethod: PaymentMethod.CASH,
        receivedAt: now,
        studentCharge: charge,
      } as StudentPayment);

      // 4) Mark the single lesson charge as fully paid.
      await em.update(
        StudentCharge,
        { id: charge.id },
        {
          chargeStatus: ChargeStatus.PAID,
        },
      );

      // 5) Mark booking FULLY_PAID and COMPLETED atomically.
      await em.update(
        Booking,
        { id: bookingId },
        {
          paymentStatus: PaymentStatus.FULLY_PAID,
          bookingStatus: BookingStatus.COMPLETED,
        },
      );

      // 6) Instructor payout — idempotent (UNIQUE(booking_id) guards double-creation)
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
          expenseDate: new Date(now.getTime() + SCHOOL_TZ_OFFSET_MS)
            .toISOString()
            .split('T')[0],
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
    return this.cancelBookingWithParty(
      bookingId,
      dto.cancellationParty,
      dto.cancellationReason,
      currentUser.userId,
    );
  }

  async cancelOwnBooking(
    userId: number,
    bookingId: number,
    dto: StudentCancelBookingDto,
  ) {
    await this.resolveStudentByUserId(userId);

    return this.cancelBookingWithParty(
      bookingId,
      CancellationParty.STUDENT,
      dto.cancellationReason,
      userId,
      userId,
    );
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  private async resolveStudentByUserId(userId: number): Promise<Student> {
    const student = await this.studentRepo.findOne({
      where: { user: { id: userId } },
      relations: { user: true },
    });

    if (!student) {
      throw new ForbiddenException('No student profile for this account');
    }

    return student;
  }

  private isStaffUser(currentUser: AuthenticatedUser): boolean {
    return currentUser.roles.some(
      (r) =>
        r === RoleTitle.RECEPTIONIST ||
        r === RoleTitle.ACCOUNTANT ||
        r === RoleTitle.MANAGER,
    );
  }

  private async shapeBookingList(
    bookings: Booking[],
    total: number,
    page: number,
    limit: number,
  ) {
    const payableIds = bookings
      .filter(
        (b) =>
          b.bookingStatus === BookingStatus.BOOKED &&
          b.paymentStatus === PaymentStatus.DEPOSIT_PAID,
      )
      .map((b) => b.id);

    const payableAmountMap = new Map<
      number,
      { amountDue: number; totalPaid: number }
    >();
    if (payableIds.length > 0) {
      const rows: {
        bookingId: number;
        amountDue: string;
        totalPaid: string;
      }[] = await this.dataSource.query(
        `SELECT sc.booking_id AS "bookingId",
                  sc.amount_due AS "amountDue",
                  COALESCE(SUM(sp.amount_paid), 0) AS "totalPaid"
           FROM   student_charges sc
           LEFT JOIN student_payments sp ON sp.student_charge_id = sc.id
           WHERE  sc.booking_id = ANY($1)
             AND  sc.charge_reason = $2
           GROUP  BY sc.booking_id, sc.amount_due`,
        [payableIds, ChargeReason.LESSON],
      );
      for (const r of rows) {
        payableAmountMap.set(Number(r.bookingId), {
          amountDue: parseFloat(r.amountDue),
          totalPaid: parseFloat(r.totalPaid),
        });
      }
    }
    const payableSet = new Set(payableIds);

    return {
      data: bookings.map((b) => {
        const { date, dayName, startTime, endTime } = this.toLocalSlot(
          b.startAt,
          b.endAt,
        );

        let remainingAmount: string | null = null;
        if (payableSet.has(b.id)) {
          const payableAmount = payableAmountMap.get(b.id);
          const fullPrice = payableAmount?.amountDue ?? 0;
          const paid = payableAmount?.totalPaid ?? 0;
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

  private async assembleBookingDetail(
    booking: Booking,
    viewerIsStaff: boolean,
  ) {
    const id = booking.id;

    const charges = await this.chargeRepo.find({
      where: { booking: { id } },
    });

    const chargeIds = charges.map((c) => c.id);

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

    let canPayRemainder = false;
    if (
      viewerIsStaff &&
      booking.bookingStatus === BookingStatus.BOOKED &&
      booking.paymentStatus === PaymentStatus.DEPOSIT_PAID
    ) {
      const lessonCharge = charges.find(
        (c) => c.chargeReason === ChargeReason.LESSON,
      );
      const totalPaid = paymentsWithCharge.reduce(
        (sum, p) => sum + parseFloat(p.amountPaid.toString()),
        0,
      );
      canPayRemainder = lessonCharge
        ? parseFloat(lessonCharge.amountDue) - totalPaid > 0
        : false;
    }

    const { date, dayName, startTime, endTime } = this.toLocalSlot(
      booking.startAt,
      booking.endAt,
    );

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

  private async cancelBookingWithParty(
    bookingId: number,
    cancellationParty: CancellationParty,
    cancellationReason: string,
    cancellingUserId: number,
    ownerUserId?: number,
  ) {
    let studentUser!: User;

    await this.dataSource.transaction(async (em) => {
      const booking = await em.findOne(Booking, {
        where: { id: bookingId },
        relations: { student: { user: true } },
        lock: { mode: 'pessimistic_write' },
      });

      if (!booking) throw new NotFoundException('Booking not found');

      if (
        ownerUserId !== undefined &&
        Number(booking.student.user.id) !== ownerUserId
      ) {
        throw new NotFoundException('Booking not found');
      }

      const cancellable = [BookingStatus.BOOKED, BookingStatus.PENDING_PAYMENT];
      if (!cancellable.includes(booking.bookingStatus)) {
        throw new BadRequestException(
          `Cannot cancel a booking with status '${booking.bookingStatus}'`,
        );
      }

      const depositStatus =
        cancellationParty === CancellationParty.STUDENT
          ? PaymentStatus.DEPOSIT_NON_REFUNDABLE
          : PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING;

      await em.update(
        Booking,
        { id: bookingId },
        {
          bookingStatus: BookingStatus.CANCELLED,
          paymentStatus: depositStatus,
        },
      );

      const cancellingUser = await em.findOne(User, {
        where: { id: cancellingUserId },
      });

      await em.save(BookingCancellation, {
        cancellationParty,
        cancellationReason,
        cancelledAt: new Date(),
        booking: { id: bookingId } as Booking,
        cancelledByUser: cancellingUser,
      } as BookingCancellation);

      studentUser = booking.student.user;
    });

    await this.notificationsService.sendAsync({
      recipientUser: studentUser,
      title: 'تم إلغاء الحجز',
      body: `تم إلغاء درسك. السبب: ${cancellationReason}. يرجى حجز موعد بديل.`,
      notificationType: NotificationType.BOOKING_CANCELLED,
    });

    return { message: 'تم إلغاء الحجز بنجاح', bookingId };
  }

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
    const localUTCMidnight = new Date(
      Date.UTC(
        startAt.getUTCFullYear(),
        startAt.getUTCMonth(),
        startAt.getUTCDate(),
      ),
    );
    const availStart = new Date(
      localUTCMidnight.getTime() + (sh * 60 + sm) * 60_000,
    );
    const availEnd = new Date(
      localUTCMidnight.getTime() + (eh * 60 + em2) * 60_000,
    );

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
        {
          booked: BookingStatus.BOOKED,
          pending: BookingStatus.PENDING_PAYMENT,
          utcNow: new Date(),
        },
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
      trainingType === TrainingType.MANUAL
        ? VehicleType.MANUAL
        : VehicleType.AUTOMATIC;

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
