import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, MoreThan, Repository } from 'typeorm';
import {
  BookingStatus,
  CancellationParty,
  ExpenseCategory,
  ExpenseStatus,
  NotificationType,
  PaymentStatus,
  VehicleExpenseReason,
  VehicleStatus,
  VehicleUnavailableReasonType,
} from '../common/enums/index';
import { Employee } from '../employees/employee.entity';
import { Expense } from '../expenses/expense.entity';
import { ExpenseVehicle } from '../expenses/expense-vehicle.entity';
import { Booking } from '../booking/booking.entity';
import { BookingCancellation } from '../booking/booking-cancellation.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { AddFuelDto } from './dto/add-fuel.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { FindVehiclesQueryDto } from './dto/find-vehicles-query.dto';
import { ReturnFromMaintenanceDto } from './dto/return-from-maintenance.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { VehicleUnavailablePeriod } from './vehicle-unavailable-period.entity';
import { Vehicle } from './vehicle.entity';

const SCHOOL_TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepo: Repository<Vehicle>,
    @InjectRepository(VehicleUnavailablePeriod)
    private readonly unavailableRepo: Repository<VehicleUnavailablePeriod>,
    @InjectRepository(Employee)
    private readonly employeeRepo: Repository<Employee>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    private readonly notificationsService: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: FindVehiclesQueryDto) {
    const qb = this.vehicleRepo
      .createQueryBuilder('vehicle')
      .orderBy('vehicle.id', 'DESC');

    if (query.status) {
      qb.andWhere('vehicle.status = :status', { status: query.status });
    }

    if (query.type) {
      qb.andWhere('vehicle.type = :type', { type: query.type });
    }

    if (query.search) {
      qb.andWhere(
        '(vehicle.plateNumber ILIKE :search OR vehicle.model ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const vehicles = await qb.getMany();
    return vehicles.map((v) => this.toSummary(v));
  }

  async findOne(id: number) {
    const vehicle = await this.vehicleRepo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('المركبة غير موجودة');

    const activePeriod = await this.unavailableRepo.findOne({
      where: { vehicle: { id }, endAt: IsNull() },
    });

    return {
      ...this.toSummary(vehicle),
      adminNotes: vehicle.adminNotes,
      createdAt: vehicle.createdAt,
      currentMaintenancePeriod: activePeriod
        ? {
            id: Number(activePeriod.id),
            startAt: activePeriod.startAt,
            notes: activePeriod.notes,
          }
        : null,
    };
  }

  async create(dto: CreateVehicleDto) {
    const vehicle = this.vehicleRepo.create({
      plateNumber: dto.plateNumber,
      model: dto.model ?? null,
      color: dto.color ?? null,
      type: dto.type,
      status: VehicleStatus.ACTIVE,
      adminNotes: dto.adminNotes ?? null,
    });

    const saved = await this.vehicleRepo.save(vehicle);
    return this.toSummary(saved);
  }

  async update(id: number, dto: UpdateVehicleDto) {
    const vehicle = await this.vehicleRepo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('المركبة غير موجودة');

    if (dto.plateNumber !== undefined) vehicle.plateNumber = dto.plateNumber;
    if (dto.model !== undefined) vehicle.model = dto.model ?? null;
    if (dto.color !== undefined) vehicle.color = dto.color ?? null;
    if (dto.type !== undefined) vehicle.type = dto.type;
    if (dto.adminNotes !== undefined)
      vehicle.adminNotes = dto.adminNotes ?? null;

    const saved = await this.vehicleRepo.save(vehicle);
    return this.toSummary(saved);
  }

  async archiveVehicle(id: number) {
    const vehicle = await this.vehicleRepo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('المركبة غير موجودة');

    if (vehicle.status === VehicleStatus.ARCHIVED) {
      throw new BadRequestException('المركبة مؤرشفة مسبقاً');
    }

    if (vehicle.status === VehicleStatus.INACTIVE) {
      throw new BadRequestException(
        'لا يمكن أرشفة مركبة في الصيانة — أرجعها للعمل أولاً',
      );
    }

    const futureBookings = await this.bookingRepo.find({
      where: {
        vehicle: { id },
        bookingStatus: BookingStatus.BOOKED,
        startAt: MoreThan(new Date()),
      },
      relations: { student: { user: true } },
    });

    await this.dataSource.transaction(async (em) => {
      vehicle.status = VehicleStatus.ARCHIVED;
      await em.save(Vehicle, vehicle);

      for (const booking of futureBookings) {
        booking.bookingStatus = BookingStatus.CANCELLED;

        if (booking.paymentStatus === PaymentStatus.DEPOSIT_PAID) {
          booking.paymentStatus = PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING;
        }
        await em.save(Booking, booking);

        await em.save(
          BookingCancellation,
          em.create(BookingCancellation, {
            booking,
            cancellationParty: CancellationParty.VEHICLE,
            cancellationReason: 'تم إيقاف السيارة عن الخدمة',
            cancelledAt: new Date(),
            cancelledByUser: null,
          }),
        );
      }
    });

    if (futureBookings.length > 0) {
      const students = futureBookings.map((b) => b.student.user);
      this.notificationsService
        .sendBulkAsync(
          students,
          'تم إلغاء حجزك',
          'تم إلغاء درسك نظراً لإيقاف السيارة عن الخدمة. يمكنك إعادة الحجز ودفعتك السابقة ستُطبَّق تلقائياً.',
          NotificationType.BOOKING_CANCELLED,
        )
        .catch(() => undefined);
    }

    return {
      message: 'تم أرشفة المركبة بنجاح',
      cancelledBookings: futureBookings.length,
    };
  }

  async addFuel(id: number, dto: AddFuelDto) {
    const vehicle = await this.vehicleRepo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('المركبة غير موجودة');

    const today = this.getSchoolLocalDate();
    const totalAmount = +(dto.liters * dto.pricePerLiter).toFixed(2);

    await this.dataSource.transaction(async (em) => {
      const expense = em.create(Expense, {
        category: ExpenseCategory.VEHICLE,
        amount: String(totalAmount),
        expenseDate: today,
        status: ExpenseStatus.PAID,
        note: dto.note ?? null,
        employee: null,
      });
      const savedExpense = await em.save(Expense, expense);

      await em.save(
        ExpenseVehicle,
        em.create(ExpenseVehicle, {
          reason: VehicleExpenseReason.GAS,
          liters: String(dto.liters),
          vehicle,
          expense: savedExpense,
        }),
      );
    });

    return { message: 'تم تسجيل تعبئة الوقود وإنشاء الفاتورة بنجاح' };
  }

  async sendToMaintenance(id: number) {
    const vehicle = await this.vehicleRepo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('المركبة غير موجودة');

    if (vehicle.status !== VehicleStatus.ACTIVE) {
      throw new BadRequestException(
        'المركبة يجب أن تكون متاحة لإرسالها للصيانة',
      );
    }

    // الحجوزات المستقبلية المؤكدة لهذه السيارة
    const futureBookings = await this.bookingRepo.find({
      where: {
        vehicle: { id },
        bookingStatus: BookingStatus.BOOKED,
        startAt: MoreThan(new Date()),
      },
      relations: { student: { user: true } },
    });

    await this.dataSource.transaction(async (em) => {
      // 1) تغيير حالة السيارة
      vehicle.status = VehicleStatus.INACTIVE;
      await em.save(Vehicle, vehicle);

      // 2) فتح فترة صيانة
      await em.save(
        VehicleUnavailablePeriod,
        em.create(VehicleUnavailablePeriod, {
          startAt: new Date(),
          endAt: null,
          reasonType: VehicleUnavailableReasonType.MAINTENANCE,
          notes: null,
          vehicle,
        }),
      );

      // 3) إلغاء الحجوزات المستقبلية
      for (const booking of futureBookings) {
        booking.bookingStatus = BookingStatus.CANCELLED;

        // نحوّل الدفعة لـ "متاحة لإعادة الحجز" بدلاً من مصادرتها
        if (booking.paymentStatus === PaymentStatus.DEPOSIT_PAID) {
          booking.paymentStatus = PaymentStatus.DEPOSIT_AVAILABLE_FOR_REBOOKING;
        }
        await em.save(Booking, booking);

        await em.save(
          BookingCancellation,
          em.create(BookingCancellation, {
            booking,
            cancellationParty: CancellationParty.VEHICLE,
            cancellationReason: 'عطل في السيارة',
            cancelledAt: new Date(),
            cancelledByUser: null,
          }),
        );
      }
    });

    // 4) إرسال إشعارات للطلاب بعد انتهاء الـ transaction (في الخلفية)
    if (futureBookings.length > 0) {
      const students = futureBookings.map((b) => b.student.user);
      this.notificationsService
        .sendBulkAsync(
          students,
          'تم إلغاء حجزك',
          'تم إلغاء درسك بسبب عطل في السيارة. يمكنك إعادة الحجز ودفعتك السابقة ستُطبَّق تلقائياً.',
          NotificationType.BOOKING_CANCELLED,
        )
        .catch(() => undefined);
    }

    return {
      message: 'تم إرسال السيارة للصيانة بنجاح',
      cancelledBookings: futureBookings.length,
    };
  }

  async returnFromMaintenance(
    id: number,
    dto: ReturnFromMaintenanceDto,
    performedByUserId: number,
  ) {
    const vehicle = await this.vehicleRepo.findOne({ where: { id } });
    if (!vehicle) throw new NotFoundException('المركبة غير موجودة');

    if (vehicle.status !== VehicleStatus.INACTIVE) {
      throw new BadRequestException('المركبة ليست في الصيانة حالياً');
    }

    const openPeriod = await this.unavailableRepo.findOne({
      where: {
        vehicle: { id },
        endAt: IsNull(),
        reasonType: VehicleUnavailableReasonType.MAINTENANCE,
      },
    });

    if (!openPeriod) {
      throw new BadRequestException('لا يوجد سجل صيانة مفتوح لهذه المركبة');
    }

    const employee = await this.employeeRepo.findOne({
      where: { user: { id: performedByUserId } },
    });

    const today = this.getSchoolLocalDate();

    await this.dataSource.transaction(async (em) => {
      openPeriod.endAt = new Date();
      if (dto.notes) openPeriod.notes = dto.notes;
      await em.save(VehicleUnavailablePeriod, openPeriod);

      vehicle.status = VehicleStatus.ACTIVE;
      await em.save(Vehicle, vehicle);

      if (dto.maintenanceCost > 0) {
        const expense = em.create(Expense, {
          category: ExpenseCategory.VEHICLE,
          amount: String(dto.maintenanceCost),
          expenseDate: today,
          status: dto.expenseStatus,
          note: dto.notes ?? null,
          employee: employee ?? null,
        });
        const savedExpense = await em.save(Expense, expense);

        await em.save(
          ExpenseVehicle,
          em.create(ExpenseVehicle, {
            reason: VehicleExpenseReason.MAINTENANCE,
            liters: null,
            vehicle,
            expense: savedExpense,
          }),
        );
      }
    });

    return { message: 'تم إرجاع المركبة للعمل وإنشاء فاتورة الصيانة بنجاح' };
  }

  private toSummary(v: Vehicle) {
    return {
      id: Number(v.id),
      plateNumber: v.plateNumber,
      model: v.model,
      color: v.color,
      type: v.type,
      status: v.status,
    };
  }

  private getSchoolLocalDate(): string {
    return new Date(Date.now() + SCHOOL_TZ_OFFSET_MS)
      .toISOString()
      .split('T')[0];
  }
}
