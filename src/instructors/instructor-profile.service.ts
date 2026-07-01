import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  BookingStatus,
  CancellationParty,
  DayOfWeek,
  ExpenseCategory,
  ExpenseStatus,
  Gender,
  InstructorPriceType,
  NotificationType,
  PaymentStatus,
} from '../common/enums/index';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
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
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateDayScheduleDto } from './dto/update-day-schedule.dto';
import { SubmitLeaveDto } from './dto/submit-leave.dto';
import { InstructorBookingsQueryDto } from './dto/instructor-bookings-query.dto';

// UTC+3 offset for deriving local wall-clock "now" against TIMESTAMP WITHOUT TIME ZONE columns.
const SCHOOL_TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

// JS getUTCDay() → DayOfWeek enum (0 = Sunday)
const JS_DAY_TO_ENUM: Record<number, DayOfWeek> = {
  0: DayOfWeek.SUN,
  1: DayOfWeek.MON,
  2: DayOfWeek.TUE,
  3: DayOfWeek.WED,
  4: DayOfWeek.THU,
  5: DayOfWeek.FRI,
  6: DayOfWeek.SAT,
};

// DayOfWeek enum → JS getUTCDay() index
const ENUM_TO_JS_DAY: Record<DayOfWeek, number> = {
  [DayOfWeek.SUN]: 0,
  [DayOfWeek.MON]: 1,
  [DayOfWeek.TUE]: 2,
  [DayOfWeek.WED]: 3,
  [DayOfWeek.THU]: 4,
  [DayOfWeek.FRI]: 5,
  [DayOfWeek.SAT]: 6,
};

const ALL_DAYS: DayOfWeek[] = [
  DayOfWeek.SAT,
  DayOfWeek.SUN,
  DayOfWeek.MON,
  DayOfWeek.TUE,
  DayOfWeek.WED,
  DayOfWeek.THU,
  DayOfWeek.FRI,
];

@Injectable()
export class InstructorProfileService {
  constructor(
    @InjectRepository(Instructor)
    private readonly instructorRepo: Repository<Instructor>,
    @InjectRepository(InstructorWeeklyAvailability)
    private readonly weeklyAvailRepo: Repository<InstructorWeeklyAvailability>,
    @InjectRepository(InstructorUnavailablePeriod)
    private readonly unavailRepo: Repository<InstructorUnavailablePeriod>,
    @InjectRepository(InstructorPrice)
    private readonly instrPriceRepo: Repository<InstructorPrice>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(BookingCancellation)
    private readonly cancellationRepo: Repository<BookingCancellation>,
    @InjectRepository(Expense)
    private readonly expenseRepo: Repository<Expense>,
    @InjectRepository(ExpenseInstructor)
    private readonly expInstrRepo: Repository<ExpenseInstructor>,
    @InjectRepository(Setting)
    private readonly settingRepo: Repository<Setting>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Private Utilities ──────────────────────────────────────────────────────

  private async loadInstructor(id: number): Promise<Instructor> {
    const instructor = await this.instructorRepo
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.user', 'u')
      .where('i.id = :id', { id })
      .getOne();
    if (!instructor) throw new NotFoundException('المدرب غير موجود');
    return instructor;
  }

  private async getNumericSetting(key: string, fallback: number): Promise<number> {
    const s = await this.settingRepo.findOne({ where: { key } });
    return s ? parseFloat(s.value) : fallback;
  }

  /** Returns the effective instructor session wage by gender, as of today. */
  private async getEffectiveInstructorPrice(gender: Gender, asOf: Date): Promise<number> {
    const type = gender === Gender.MALE ? InstructorPriceType.MALE : InstructorPriceType.FEMALE;
    const dateStr = asOf.toISOString().split('T')[0];
    const ip = await this.instrPriceRepo
      .createQueryBuilder('ip')
      .where('ip.type = :type', { type })
      .andWhere('ip.effectiveFrom <= :asOf', { asOf: dateStr })
      .orderBy('ip.effectiveFrom', 'DESC')
      .getOne();
    if (!ip) return 0;
    return parseFloat(ip.price);
  }

  /**
   * Parses a local wall-clock datetime string "YYYY-MM-DDTHH:MM" using Date.UTC
   * so the result is independent of the Node.js process timezone.
   */
  private parseLocalDateTime(value: string): Date {
    const [datePart, timePart] = value.split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [h, min] = (timePart ?? '00:00').split(':').map(Number);
    return new Date(Date.UTC(y, m - 1, d, h, min, 0));
  }

  /**
   * Computes the "local today" Date object whose UTC components equal the
   * school's local wall-clock date components.
   */
  private localNow(): Date {
    return new Date(new Date().getTime() + SCHOOL_TZ_OFFSET_MS);
  }

  /** Returns "YYYY-MM-DD" string derived from a local-frame Date. */
  private toLocalDateStr(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  // ─── 2.A — Profile header ──────────────────────────────────────────────────

  async getProfile(instructorId: number) {
    const instructor = await this.loadInstructor(instructorId);
    const now = new Date();
    // localNow UTC components = local wall-clock — used for TIMESTAMP columns
    const localNow = this.localNow();
    const localToday = this.toLocalDateStr(localNow);

    // Effective session wage
    const sessionWage = await this.getEffectiveInstructorPrice(instructor.gender, localNow);

    // Leave status derived from instructor_unavailable_periods covering today
    // start_at / end_at are TIMESTAMP (local wall-clock)
    const todayStart = new Date(Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate(),
    ));
    const tomorrowStart = new Date(Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate() + 1,
    ));

    const todayLeaves = await this.unavailRepo
      .createQueryBuilder('p')
      .where('p.instructor = :id', { id: instructorId })
      // Overlapping with today: startAt < tomorrow AND endAt > today
      .andWhere('p.startAt < :tomorrowStart', { tomorrowStart })
      .andWhere('p.endAt > :todayStart', { todayStart })
      .getMany();

    let leaveStatus: 'FULL_DAY_LEAVE' | 'PARTIAL_LEAVE' | null = null;
    if (todayLeaves.length > 0) {
      const isFullDay = todayLeaves.some(
        (l) =>
          l.startAt.getTime() <= todayStart.getTime() &&
          l.endAt.getTime() >= tomorrowStart.getTime(),
      );
      leaveStatus = isFullDay ? 'FULL_DAY_LEAVE' : 'PARTIAL_LEAVE';
    }

    // Today's lesson count
    // start_at is TIMESTAMP (local) — compare localToday string against DATE cast
    const todayLessonsCount: number = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.instructor = :id', { id: instructorId })
      // Cast TIMESTAMP column to date for local-day comparison
      .andWhere(`DATE(b.startAt) = :localToday`, { localToday })
      .andWhere(
        `(b.bookingStatus IN (:...statuses) OR (b.bookingStatus = :pending AND b.lockedUntil > :utcNow))`,
        {
          statuses: [BookingStatus.BOOKED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW],
          pending: BookingStatus.PENDING_PAYMENT,
          utcNow: now, // lockedUntil is TIMESTAMPTZ — compare against real UTC now
        },
      )
      .getCount();

    return {
      instructorId: Number(instructor.id),
      userId: Number(instructor.user.id),
      name: instructor.user.name,
      phone: instructor.user.phone,
      gender: instructor.gender,
      instructorType: instructor.instructorType,
      accountStatus: instructor.user.accountStatus,
      sessionWage,
      todayLessonsCount,
      leaveStatus,
    };
  }

  // ─── 2.B — Weekly schedule (display) ──────────────────────────────────────

  async getSchedule(instructorId: number) {
    await this.loadInstructor(instructorId);

    const rows = await this.weeklyAvailRepo.find({
      where: { instructor: { id: instructorId } },
      order: { startTime: 'ASC' },
    });

    return {
      schedule: ALL_DAYS.map((day) => ({
        dayOfWeek: day,
        periods: rows
          .filter((r) => r.dayOfWeek === day)
          .map((r) => ({ startTime: r.startTime, endTime: r.endTime })),
      })),
    };
  }

  // ─── 2.B — Weekly schedule (edit) ─────────────────────────────────────────

  async updateDaySchedule(
    instructorId: number,
    dto: UpdateDayScheduleDto,
  ) {
    await this.loadInstructor(instructorId);

    // ── Step 1: Validate periods ───────────────────────────────────────────
    for (const p of dto.periods) {
      if (p.startTime >= p.endTime) {
        throw new BadRequestException(
          `الفترة غير صالحة: ${p.startTime}–${p.endTime}. يجب أن يكون وقت البداية قبل وقت النهاية.`,
        );
      }
    }
    const sorted = [...dto.periods].sort((a, b) =>
      a.startTime.localeCompare(b.startTime),
    );
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].startTime < sorted[i - 1].endTime) {
        throw new BadRequestException(
          `الفترات متداخلة: ${sorted[i - 1].startTime}–${sorted[i - 1].endTime} و ${sorted[i].startTime}–${sorted[i].endTime}`,
        );
      }
    }

    // ── Step 2: Booking-window guard ──────────────────────────────────────
    const now = new Date();
    const localNow = this.localNow();
    // localNow UTC components = local wall-clock
    const todayJsDay = localNow.getUTCDay();
    const targetJsDay = ENUM_TO_JS_DAY[dto.dayOfWeek];
    const daysUntilNext = (targetJsDay - todayJsDay + 7) % 7;
    // If daysUntilNext === 0, the target day IS today — treat as 0 days away
    const nextOccurrenceMidnight = new Date(Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate() + daysUntilNext,
    ));
    const nextOccurrenceDateStr = this.toLocalDateStr(nextOccurrenceMidnight);

    const windowDays = await this.getNumericSetting('booking_window_days', 4);
    const windowEndMidnight = new Date(Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      localNow.getUTCDate() + windowDays,
    ));

    const isInsideWindow = nextOccurrenceMidnight < windowEndMidnight;

    if (isInsideWindow) {
      // Find reserving bookings on that specific date for this instructor
      // start_at is TIMESTAMP (local) — DATE cast gives local date
      const reservingBookings = await this.bookingRepo
        .createQueryBuilder('b')
        .innerJoinAndSelect('b.student', 's')
        .innerJoinAndSelect('s.user', 'su')
        .where('b.instructor = :id', { id: instructorId })
        .andWhere(`DATE(b.startAt) = :occDate`, { occDate: nextOccurrenceDateStr })
        .andWhere(
          `(b.bookingStatus = :booked OR (b.bookingStatus = :pending AND b.lockedUntil > :utcNow))`,
          { booked: BookingStatus.BOOKED, pending: BookingStatus.PENDING_PAYMENT, utcNow: now },
        )
        .getMany();

      if (reservingBookings.length > 0) {
        // Build merged periods to check against
        const mergedPeriods = this.mergePeriods(sorted);

        const conflicting = reservingBookings.filter((b) => {
          const bStartH = b.startAt.getUTCHours();
          const bStartM = b.startAt.getUTCMinutes();
          const bEndH = b.endAt.getUTCHours();
          const bEndM = b.endAt.getUTCMinutes();
          const bStartTime = `${String(bStartH).padStart(2, '0')}:${String(bStartM).padStart(2, '0')}`;
          const bEndTime = `${String(bEndH).padStart(2, '0')}:${String(bEndM).padStart(2, '0')}`;
          // Booking must fit ENTIRELY within one merged period
          return !mergedPeriods.some(
            (p) => bStartTime >= p.startTime && bEndTime <= p.endTime,
          );
        });

        if (conflicting.length > 0) {
          throw new ConflictException({
            message: 'لا يمكن تعديل الجدول: توجد حجوزات متعارضة في نافذة الحجز. قم بتسجيل إجازة ساعية لتلك الأوقات أولاً ثم أعد المحاولة.',
            conflictingBookings: conflicting.map((b) => ({
              bookingId: Number(b.id),
              studentName: b.student.user.name,
              startAt: b.startAt,
              endAt: b.endAt,
            })),
          });
        }
      }
    }

    // ── Step 3: Replace-all in transaction ────────────────────────────────
    await this.dataSource.transaction(async (em) => {
      await em
        .createQueryBuilder()
        .delete()
        .from(InstructorWeeklyAvailability)
        .where('instructor_id = :id', { id: instructorId })
        .andWhere('day_of_week = :day', { day: dto.dayOfWeek })
        .execute();

      if (sorted.length > 0) {
        const rows = sorted.map((p) => ({
          dayOfWeek: dto.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
          instructor: { id: instructorId } as Instructor,
        }));
        await em.save(InstructorWeeklyAvailability, rows as InstructorWeeklyAvailability[]);
      }
    });

    return {
      message: 'تم تحديث الجدول بنجاح',
      dayOfWeek: dto.dayOfWeek,
      periods: sorted,
    };
  }

  /**
   * Merges contiguous or touching periods (sorted by startTime).
   * E.g. 08:00–11:00 + 11:00–14:00 → 08:00–14:00 so a lesson crossing 11:00 is not wrongly rejected.
   */
  private mergePeriods(
    sorted: { startTime: string; endTime: string }[],
  ): { startTime: string; endTime: string }[] {
    if (sorted.length === 0) return [];
    const result = [{ ...sorted[0] }];
    for (let i = 1; i < sorted.length; i++) {
      const last = result[result.length - 1];
      if (sorted[i].startTime <= last.endTime) {
        last.endTime =
          sorted[i].endTime > last.endTime ? sorted[i].endTime : last.endTime;
      } else {
        result.push({ ...sorted[i] });
      }
    }
    return result;
  }

  // ─── 2.C — Instructor bookings list ───────────────────────────────────────

  async getBookings(instructorId: number, query: InstructorBookingsQueryDto) {
    await this.loadInstructor(instructorId);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.bookingRepo
      .createQueryBuilder('b')
      .innerJoinAndSelect('b.student', 's')
      .innerJoinAndSelect('s.user', 'su')
      .where('b.instructor = :id', { id: instructorId });

    if (query.viewMode === 'day') {
      if (!query.date) throw new BadRequestException('date مطلوب في وضع العرض اليومي');
      // start_at is TIMESTAMP (local)
      qb.andWhere(`DATE(b.startAt) = :date`, { date: query.date });
    } else {
      if (!query.weekStart) throw new BadRequestException('weekStart مطلوب في وضع العرض الأسبوعي');
      const [y, m, d] = query.weekStart.split('-').map(Number);
      const weekStartMs = new Date(Date.UTC(y, m - 1, d));
      const weekEndMs   = new Date(Date.UTC(y, m - 1, d + 7));
      // start_at is TIMESTAMP (local) — compare directly (UTC components = local values)
      qb.andWhere('b.startAt >= :weekStart', { weekStart: weekStartMs });
      qb.andWhere('b.startAt < :weekEnd',   { weekEnd: weekEndMs });
    }

    if (query.bookingStatus) {
      qb.andWhere('b.bookingStatus = :status', { status: query.bookingStatus });
    }

    qb.orderBy('b.startAt', 'ASC').skip(skip).take(limit);

    const [bookings, total] = await qb.getManyAndCount();

    const pad = (n: number) => String(n).padStart(2, '0');

    return {
      data: bookings.map((b) => ({
        id: Number(b.id),
        date: b.startAt.toISOString().slice(0, 10),
        startTime: `${pad(b.startAt.getUTCHours())}:${pad(b.startAt.getUTCMinutes())}`,
        endTime: `${pad(b.endAt.getUTCHours())}:${pad(b.endAt.getUTCMinutes())}`,
        bookingStatus: b.bookingStatus,
        paymentStatus: b.paymentStatus,
        trainingType: b.trainingType,
        vehicleSource: b.vehicleSource,
        student: {
          id: Number(b.student.id),
          name: b.student.user.name,
          phone: b.student.user.phone,
        },
      })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  // ─── 2.D — Statistics ─────────────────────────────────────────────────────

  async getStats(instructorId: number) {
    const instructor = await this.loadInstructor(instructorId);
    const now = new Date();
    // localNow UTC components = local wall-clock — used for TIMESTAMP columns
    const localNow = this.localNow();
    const localToday = this.toLocalDateStr(localNow);

    // Month boundaries in local wall-clock frame
    const monthStart = new Date(Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth(),
      1,
    ));
    const monthEnd = new Date(Date.UTC(
      localNow.getUTCFullYear(),
      localNow.getUTCMonth() + 1,
      1,
    ));
    const monthStartStr = this.toLocalDateStr(monthStart);
    const monthEndStr   = this.toLocalDateStr(monthEnd);

    // Sessions this month — start_at is TIMESTAMP (local)
    const sessionsThisMonth: number = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.instructor = :id', { id: instructorId })
      .andWhere('b.bookingStatus = :status', { status: BookingStatus.COMPLETED })
      .andWhere('b.startAt >= :monthStart', { monthStart })
      .andWhere('b.startAt < :monthEnd', { monthEnd })
      .getCount();

    // No-shows this month
    const noShowsThisMonth: number = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.instructor = :id', { id: instructorId })
      .andWhere('b.bookingStatus = :status', { status: BookingStatus.NO_SHOW })
      .andWhere('b.startAt >= :monthStart', { monthStart })
      .andWhere('b.startAt < :monthEnd', { monthEnd })
      .getCount();

    // Completion rate = COMPLETED / (COMPLETED + NO_SHOW) this month
    const denominator = sessionsThisMonth + noShowsThisMonth;
    const completionRate =
      denominator > 0
        ? Math.round((sessionsThisMonth / denominator) * 1000) / 10  // e.g. 85.7
        : null;

    // Today's lessons count — start_at is TIMESTAMP (local)
    const todayLessonsCount: number = await this.bookingRepo
      .createQueryBuilder('b')
      .where('b.instructor = :id', { id: instructorId })
      .andWhere(`DATE(b.startAt) = :localToday`, { localToday })
      .andWhere(
        `(b.bookingStatus IN (:...statuses) OR (b.bookingStatus = :pending AND b.lockedUntil > :utcNow))`,
        {
          statuses: [BookingStatus.BOOKED, BookingStatus.COMPLETED, BookingStatus.NO_SHOW],
          pending: BookingStatus.PENDING_PAYMENT,
          utcNow: now, // lockedUntil is TIMESTAMPTZ — compare against real UTC now
        },
      )
      .getCount();

    // Due today — UNPAID expenses linked to lessons completed today
    // expense_date is DATE (local), status is ENUM
    const dueTodayRows: { total: string }[] = await this.dataSource.query(
      `SELECT COALESCE(SUM(e.amount), 0) AS total
       FROM expenses e
       JOIN expenses_instructor ei ON ei.expense_id = e.id
       JOIN booking b ON b.id = ei.booking_id
       WHERE b.instructor_id = $1
         AND e.category = $2
         AND e.status = $3
         AND e.expense_date = $4`,
      [instructorId, ExpenseCategory.INSTRUCTOR, ExpenseStatus.UNPAID, localToday],
    );
    const dueToday = parseFloat(dueTodayRows[0]?.total ?? '0');

    // Total outstanding dues — all UNPAID instructor expenses
    const totalOutstandingRows: { total: string }[] = await this.dataSource.query(
      `SELECT COALESCE(SUM(e.amount), 0) AS total
       FROM expenses e
       JOIN expenses_instructor ei ON ei.expense_id = e.id
       JOIN booking b ON b.id = ei.booking_id
       WHERE b.instructor_id = $1
         AND e.category = $2
         AND e.status = $3`,
      [instructorId, ExpenseCategory.INSTRUCTOR, ExpenseStatus.UNPAID],
    );
    const totalOutstanding = parseFloat(totalOutstandingRows[0]?.total ?? '0');

    // Session wage (effective instructor_price by gender, as of today)
    const sessionWage = await this.getEffectiveInstructorPrice(instructor.gender, localNow);

    return {
      sessionsThisMonth,
      noShowsThisMonth,
      completionRate,        // percentage 0–100 or null if no data
      todayLessonsCount,
      dueToday,
      totalOutstanding,
      sessionWage,
    };
  }

  // ─── 2.E — Instructor dues (breakdown) ────────────────────────────────────

  async getDues(instructorId: number) {
    await this.loadInstructor(instructorId);

    const rows: { expense_date: string; lesson_count: string; day_total: string }[] =
      await this.dataSource.query(
        `SELECT e.expense_date,
                COUNT(*) AS lesson_count,
                SUM(e.amount) AS day_total
         FROM expenses e
         JOIN expenses_instructor ei ON ei.expense_id = e.id
         JOIN booking b ON b.id = ei.booking_id
         WHERE b.instructor_id = $1
           AND e.category = $2
           AND e.status = $3
         GROUP BY e.expense_date
         ORDER BY e.expense_date ASC`,
        [instructorId, ExpenseCategory.INSTRUCTOR, ExpenseStatus.UNPAID],
      );

    const totalOutstanding = rows.reduce((sum, r) => sum + parseFloat(r.day_total), 0);

    return {
      totalOutstanding: Math.round(totalOutstanding * 100) / 100,
      perDay: rows.map((r) => ({
        date: r.expense_date,
        lessonCount: Number(r.lesson_count),
        amount: parseFloat(r.day_total),
      })),
    };
  }

  // ─── 2.E — Pay instructor dues ─────────────────────────────────────────────

  async payDues(instructorId: number) {
    const instructor = await this.loadInstructor(instructorId);
    let instructorUser!: User;

    const result = await this.dataSource.transaction(async (em) => {
      // Lock instructor row to prevent race with concurrent booking creation
      await em.query(
        `SELECT id FROM instructors WHERE id = $1 FOR UPDATE`,
        [instructorId],
      );

      // Find all UNPAID instructor expenses for this instructor
      const unpaidRows: { expense_id: string }[] = await em.query(
        `SELECT ei.expense_id
         FROM expenses_instructor ei
         JOIN booking b ON b.id = ei.booking_id
         JOIN expenses e ON e.id = ei.expense_id
         WHERE b.instructor_id = $1
           AND e.category = $2
           AND e.status = $3`,
        [instructorId, ExpenseCategory.INSTRUCTOR, ExpenseStatus.UNPAID],
      );

      if (unpaidRows.length === 0) {
        return { settled: 0, totalAmount: 0 };
      }

      const expenseIds = unpaidRows.map((r) => Number(r.expense_id));
      const paidAt = new Date();

      // Settle all UNPAID expenses in one UPDATE
      await em
        .createQueryBuilder()
        .update(Expense)
        .set({ status: ExpenseStatus.PAID, paidAt })
        .where({ id: In(expenseIds) })
        .execute();

      // Collect total for response
      const totalRows: { total: string }[] = await em.query(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM expenses
         WHERE id = ANY($1)`,
        [expenseIds],
      );
      const totalAmount = parseFloat(totalRows[0]?.total ?? '0');

      instructorUser = instructor.user;
      return { settled: expenseIds.length, totalAmount };
    });

    if (result.settled > 0) {
      await this.notificationsService.sendAsync({
        recipientUser: instructorUser,
        title: 'تم صرف مستحقاتك',
        body: `تم دفع مستحقاتك البالغة ${result.totalAmount} ليرة سورية بنجاح.`,
        notificationType: NotificationType.GENERAL,
      });
    }

    return {
      message: result.settled > 0 ? 'تم دفع المستحقات بنجاح' : 'لا توجد مستحقات غير مدفوعة',
      settledCount: result.settled,
      totalAmount: result.totalAmount,
    };
  }

  // ─── 2.F — Submit leave ────────────────────────────────────────────────────

  async submitLeave(
    instructorId: number,
    dto: SubmitLeaveDto,
    currentUser: AuthenticatedUser,
  ) {
    await this.loadInstructor(instructorId);

    // ── Resolve leave period in local wall-clock TIMESTAMP frame ──────────
    let leaveStart: Date;
    let leaveEnd: Date;

    if (dto.date) {
      // Full-day leave: date 00:00 → (date+1) 00:00 (local wall-clock)
      const [y, m, d] = dto.date.split('-').map(Number);
      leaveStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      leaveEnd   = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
    } else if (dto.startAt && dto.endAt) {
      // Hourly leave — local wall-clock datetime string
      leaveStart = this.parseLocalDateTime(dto.startAt);
      leaveEnd   = this.parseLocalDateTime(dto.endAt);
      if (leaveStart >= leaveEnd) {
        throw new BadRequestException('وقت بداية الإجازة يجب أن يكون قبل وقت نهايتها');
      }
    } else {
      throw new BadRequestException('يجب تحديد تاريخ للإجازة الكاملة أو وقت البداية والنهاية للإجازة الساعية');
    }

    const now = new Date(); // real UTC — for lockedUntil comparison (TIMESTAMPTZ)

    // Capture affected students for post-commit notifications
    const affectedStudentUsers: User[] = [];
    let leaveId!: number;

    await this.dataSource.transaction(async (em) => {
      // Lock the instructor row to prevent a race with concurrent booking creation.
      // createReceptionBooking also locks the instructor row, so they are mutually exclusive.
      await em.query(
        `SELECT id FROM instructors WHERE id = $1 FOR UPDATE`,
        [instructorId],
      );

      // Reject if an overlapping leave already exists for this instructor
      const overlappingLeave = await em
        .createQueryBuilder(InstructorUnavailablePeriod, 'p')
        .where('p.instructor = :id', { id: instructorId })
        .andWhere('p.startAt < :leaveEnd', { leaveEnd })
        .andWhere('p.endAt > :leaveStart', { leaveStart })
        .getOne();
      if (overlappingLeave) {
        throw new ConflictException(
          `يوجد تداخل مع إجازة مسجّلة مسبقاً من ${overlappingLeave.startAt.toISOString()} إلى ${overlappingLeave.endAt.toISOString()}`,
        );
      }

      // Insert the leave period — leaveStart/leaveEnd are TIMESTAMP (local wall-clock)
      const leave = await em.save(InstructorUnavailablePeriod, {
        startAt: leaveStart,
        endAt: leaveEnd,
        reason: dto.reason ?? null,
        instructor: { id: instructorId } as Instructor,
      } as InstructorUnavailablePeriod);
      leaveId = Number(leave.id);

      // Find reserving bookings that overlap [leaveStart, leaveEnd)
      // start_at / end_at are TIMESTAMP (local) — compare directly
      const conflicting = await em
        .createQueryBuilder(Booking, 'b')
        .innerJoinAndSelect('b.student', 's')
        .innerJoinAndSelect('s.user', 'su')
        .where('b.instructor = :id', { id: instructorId })
        .andWhere(
          `(b.bookingStatus = :booked OR (b.bookingStatus = :pending AND b.lockedUntil > :utcNow))`,
          { booked: BookingStatus.BOOKED, pending: BookingStatus.PENDING_PAYMENT, utcNow: now },
        )
        // Overlap: existing_start < leaveEnd AND existing_end > leaveStart
        .andWhere('b.startAt < :leaveEnd',   { leaveEnd })
        .andWhere('b.endAt > :leaveStart',   { leaveStart })
        .getMany();

      // Cancel each conflicting booking (instructor-caused → deposit reusable)
      const cancellingUser = await em.findOne(User, { where: { id: currentUser.userId } });

      for (const booking of conflicting) {
        await em.update(Booking, { id: booking.id }, {
          bookingStatus: BookingStatus.CANCELLED,
          paymentStatus: PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING,
        });

        await em.save(BookingCancellation, {
          cancellationParty: CancellationParty.INSTRUCTOR,
          cancellationReason: dto.reason ?? 'إجازة مدرب',
          cancelledAt: now,
          booking: { id: booking.id } as Booking,
          cancelledByUser: cancellingUser,
        } as BookingCancellation);

        affectedStudentUsers.push(booking.student.user);
      }
    });

    // Notify affected students AFTER the transaction commits
    for (const studentUser of affectedStudentUsers) {
      await this.notificationsService.sendAsync({
        recipientUser: studentUser,
        title: 'تم إلغاء درسك',
        body: 'اعتذر المدرب عن تقديم الدرس. عربونك محفوظ ومتاح للحجز في موعد آخر.',
        notificationType: NotificationType.BOOKING_CANCELLED,
      });
    }

    return {
      leaveId,
      cancelledBookingsCount: affectedStudentUsers.length,
      leaveStart,
      leaveEnd,
      message:
        affectedStudentUsers.length > 0
          ? `تم تسجيل الإجازة وإلغاء ${affectedStudentUsers.length} حجز متعارض`
          : 'تم تسجيل الإجازة بنجاح',
    };
  }

  // ─── 2.G — List leaves ─────────────────────────────────────────────────────

  async getLeaves(instructorId: number) {
    await this.loadInstructor(instructorId);

    const leaves = await this.unavailRepo.find({
      where: { instructor: { id: instructorId } },
      order: { startAt: 'ASC' },
    });

    return {
      leaves: leaves.map((l) => {
        const isFullDay =
          l.startAt.getUTCHours() === 0 &&
          l.startAt.getUTCMinutes() === 0 &&
          l.endAt.getUTCHours() === 0 &&
          l.endAt.getUTCMinutes() === 0;
        return {
          id: Number(l.id),
          startAt: l.startAt,
          endAt: l.endAt,
          reason: l.reason,
          isFullDay,
          createdAt: l.createdAt,
        };
      }),
    };
  }

  // ─── 2.H — Cancel (delete) a leave ────────────────────────────────────────

  async cancelLeave(instructorId: number, leaveId: number) {
    await this.loadInstructor(instructorId);

    const leave = await this.unavailRepo.findOne({
      where: { id: leaveId, instructor: { id: instructorId } },
    });
    if (!leave) throw new NotFoundException('الإجازة غير موجودة أو لا تعود لهذا المدرب');

    await this.unavailRepo.delete(leave.id);

    return { message: 'تم إلغاء الإجازة. الحجوزات التي أُلغيت بسببها تبقى ملغاة.' };
  }

  // ─── 2.I — Update a leave ──────────────────────────────────────────────────

  async updateLeave(
    instructorId: number,
    leaveId: number,
    dto: SubmitLeaveDto,
    currentUser: AuthenticatedUser,
  ) {
    await this.loadInstructor(instructorId);

    // Resolve new period
    let leaveStart: Date;
    let leaveEnd: Date;

    if (dto.date) {
      const [y, m, d] = dto.date.split('-').map(Number);
      leaveStart = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
      leaveEnd   = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
    } else if (dto.startAt && dto.endAt) {
      leaveStart = this.parseLocalDateTime(dto.startAt);
      leaveEnd   = this.parseLocalDateTime(dto.endAt);
      if (leaveStart >= leaveEnd) {
        throw new BadRequestException('وقت بداية الإجازة يجب أن يكون قبل وقت نهايتها');
      }
    } else {
      throw new BadRequestException('يجب تحديد تاريخ للإجازة الكاملة أو وقت البداية والنهاية للإجازة الساعية');
    }

    const now = new Date();
    const affectedStudentUsers: User[] = [];

    await this.dataSource.transaction(async (em) => {
      const leave = await em.findOne(InstructorUnavailablePeriod, {
        where: { id: leaveId, instructor: { id: instructorId } },
        lock: { mode: 'pessimistic_write' },
      });
      if (!leave) throw new NotFoundException('الإجازة غير موجودة أو لا تعود لهذا المدرب');

      await em.query(`SELECT id FROM instructors WHERE id = $1 FOR UPDATE`, [instructorId]);

      // Check overlap with OTHER leaves — fetch all overlapping, then exclude current in JS
      // (avoids bigint vs int4 type-mismatch in SQL != comparison with node-postgres)
      const overlappingLeaves = await em
        .createQueryBuilder(InstructorUnavailablePeriod, 'p')
        .where('p.instructor = :id', { id: instructorId })
        .andWhere('p.startAt < :leaveEnd', { leaveEnd })
        .andWhere('p.endAt > :leaveStart', { leaveStart })
        .getMany();
      const overlap = overlappingLeaves.find((p) => Number(p.id) !== leaveId);
      if (overlap) {
        throw new ConflictException(
          `يوجد تداخل مع إجازة مسجّلة مسبقاً من ${overlap.startAt.toISOString()} إلى ${overlap.endAt.toISOString()}`,
        );
      }

      // Update the leave record
      await em.update(InstructorUnavailablePeriod, { id: leaveId }, {
        startAt: leaveStart,
        endAt: leaveEnd,
        reason: dto.reason ?? null,
      });

      // Cancel any reserving bookings overlapping the NEW period that are still active
      const conflicting = await em
        .createQueryBuilder(Booking, 'b')
        .innerJoinAndSelect('b.student', 's')
        .innerJoinAndSelect('s.user', 'su')
        .where('b.instructor = :id', { id: instructorId })
        .andWhere(
          `(b.bookingStatus = :booked OR (b.bookingStatus = :pending AND b.lockedUntil > :utcNow))`,
          { booked: BookingStatus.BOOKED, pending: BookingStatus.PENDING_PAYMENT, utcNow: now },
        )
        .andWhere('b.startAt < :leaveEnd',   { leaveEnd })
        .andWhere('b.endAt > :leaveStart',   { leaveStart })
        .getMany();

      const cancellingUser = await em.findOne(User, { where: { id: currentUser.userId } });

      for (const booking of conflicting) {
        await em.update(Booking, { id: booking.id }, {
          bookingStatus: BookingStatus.CANCELLED,
          paymentStatus: PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING,
        });
        await em.save(BookingCancellation, {
          cancellationParty: CancellationParty.INSTRUCTOR,
          cancellationReason: dto.reason ?? 'تعديل إجازة مدرب',
          cancelledAt: now,
          booking: { id: booking.id } as Booking,
          cancelledByUser: cancellingUser,
        } as BookingCancellation);
        affectedStudentUsers.push(booking.student.user);
      }
    });

    for (const studentUser of affectedStudentUsers) {
      await this.notificationsService.sendAsync({
        recipientUser: studentUser,
        title: 'تم إلغاء درسك',
        body: 'تم تعديل إجازة المدرب. عربونك محفوظ ومتاح للحجز في موعد آخر.',
        notificationType: NotificationType.BOOKING_CANCELLED,
      });
    }

    return {
      leaveId,
      leaveStart,
      leaveEnd,
      cancelledBookingsCount: affectedStudentUsers.length,
      message:
        affectedStudentUsers.length > 0
          ? `تم تحديث الإجازة وإلغاء ${affectedStudentUsers.length} حجز متعارض`
          : 'تم تحديث الإجازة بنجاح',
    };
  }
}
